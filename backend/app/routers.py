from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db import get_db
from app.helper.prompt import llm

router = APIRouter()


@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT * FROM users
        ORDER BY risk_score DESC NULLS LAST
    """))
    users = [dict(row._mapping) for row in result]
    return {"users": users}


@router.post("/scan")
def scan_all(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT * FROM users"))
    users = [dict(row._mapping) for row in result]

    if not users:
        return {"message": "No users found", "scanned": 0}

    results = []
    for user in users:
        try:
            analysis = llm(user)

            db.execute(text("""
                UPDATE users SET
                    risk_score       = :risk_score,
                    risk_level       = :risk_level,
                    flag_reason      = :flag_reason,
                    signals          = :signals,
                    is_flagged       = :is_flagged,
                    last_analyzed_at = NOW()
                WHERE id = :id
            """), {
                "risk_score":  analysis["risk_score"],
                "risk_level":  analysis["risk_level"],
                "flag_reason": analysis.get("flag_reason"),
                "signals":     str(analysis.get("signals", [])),
                "is_flagged":  analysis["risk_level"] == "high",
                "id":          user["id"],
            })

            if analysis["risk_level"] == "high":
                db.execute(text("""
                    INSERT INTO risk_alerts (severity, title, description, related_user_id)
                    VALUES (:severity, :title, :description, :related_user_id)
                """), {
                    "severity":        "high",
                    "title":           f"High-risk user detected: {user['username']}",
                    "description":     analysis.get("flag_reason"),
                    "related_user_id": user["id"],
                })

            db.commit()

            results.append({
                "username":   user["username"],
                "risk_score": analysis["risk_score"],
                "risk_level": analysis["risk_level"],
            })

        except Exception as e:
            db.rollback()
            results.append({"username": user["username"], "error": str(e)})

    return {"scanned": len(results), "results": results}


@router.get("/alerts")
def list_alerts(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT a.*, u.username
        FROM risk_alerts a
        LEFT JOIN users u ON u.id = a.related_user_id
        WHERE a.resolved = false
        ORDER BY a.created_at DESC
    """))
    alerts = [dict(row._mapping) for row in result]
    return {"alerts": alerts}
"""
ShieldAI Backend Server Entry Point
"""
import uvicorn


def main():
    """Start the API server"""
    uvicorn.run(
        "src.api.server:app",
        host="127.0.0.1",
        port=8765,
        reload=True
    )


if __name__ == "__main__":
    main()

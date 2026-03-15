FROM python:3.11-slim
WORKDIR /app
COPY app /app/app
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic
RUN pip install --no-cache-dir fastapi uvicorn psycopg2-binary sqlalchemy alembic python-jose passlib[bcrypt] bcrypt==3.2.2 python-dotenv email-validator
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8080"]

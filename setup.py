from setuptools import setup, find_packages

setup(
    name="analytics",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi",
        "uvicorn",
        "sqlalchemy",
        "pydantic",
        "pytest",
        "httpx"
    ],
) 
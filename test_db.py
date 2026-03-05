import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.database import engine
from backend.models import Base
print("Registered tables:", Base.metadata.tables.keys())
Base.metadata.create_all(bind=engine)

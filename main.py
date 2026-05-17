"""AquaGrow Dashboard — entry point. Run: python main.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ui.app import AquaGrowApp

if __name__ == "__main__":
    app = AquaGrowApp()
    app.mainloop()

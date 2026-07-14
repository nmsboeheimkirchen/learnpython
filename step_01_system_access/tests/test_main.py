import unittest
import sys
import io
from unittest.mock import patch

class TestSystemAccess(unittest.TestCase):

    def run_main_with_input(self, user_input):
        captured_output = io.StringIO()
        sys.stdout = captured_output
        
        with patch('builtins.input', return_value=user_input):
            try:
                import main
                import importlib
                importlib.reload(main)
            except Exception as e:
                self.fail(f"Dein Programm hat einen Fehler (Crash): {e}. Überprüfe, ob du Klammern oder Anführungszeichen vergessen hast!")
        
        sys.stdout = sys.__stdout__
        return captured_output.getvalue().lower()

    def test_verbindung(self):
        output = self.run_main_with_input("007")
        self.assertIn("verbindung", output, "Du musst 'Verbindung zum System wird hergestellt...' als Erstes ausgeben (print).")

    def test_name_wird_ausgegeben(self):
        output = self.run_main_with_input("Morpheus")
        self.assertIn("morpheus", output, "Dein fertiges Programm muss den Namen ausgeben, den der Benutzer eingetippt hat.")

    def test_willkommen_text(self):
        output = self.run_main_with_input("Neo")
        self.assertIn("willkommen", output, "Du musst 'Willkommen, ' und den Namen der Person auf dem Bildschirm ausgeben.")

if __name__ == '__main__':
    unittest.main()

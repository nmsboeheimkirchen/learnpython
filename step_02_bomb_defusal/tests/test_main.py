import unittest
import sys
import io
from unittest.mock import patch

class TestBombDefusal(unittest.TestCase):

    def run_main_with_input(self, user_input):
        # Leite stdout in einen String-Puffer um
        captured_output = io.StringIO()
        sys.stdout = captured_output
        
        # Simuliere User-Input
        with patch('builtins.input', return_value=user_input):
            try:
                # Führe das main-Script aus
                import main
                import importlib
                importlib.reload(main)
            except Exception as e:
                self.fail(f"Dein Programm hat einen Fehler (Crash): {e}")
        
        # Setze stdout zurück
        sys.stdout = sys.__stdout__
        return captured_output.getvalue().lower()

    def test_rot_entschaerft(self):
        output = self.run_main_with_input("Rot")
        self.assertIn("entschärft", output, "Wenn 'Rot' eingegeben wird, muss das Wort 'entschärft' in der Ausgabe vorkommen.")

    def test_blau_explodiert(self):
        output = self.run_main_with_input("Blau")
        self.assertIn("kabumm", output, "Wenn 'Blau' eingegeben wird, muss das Wort 'KABUMM' in der Ausgabe vorkommen.")

    def test_gruen_explodiert(self):
        output = self.run_main_with_input("Grün")
        self.assertIn("kabumm", output, "Wenn 'Grün' eingegeben wird, muss das Wort 'KABUMM' in der Ausgabe vorkommen.")

    def test_falsche_eingabe_explodiert(self):
        output = self.run_main_with_input("Lila")
        self.assertIn("kabumm", output, "Wenn man etwas ganz anderes eingibt, muss die Bombe auch explodieren.")

if __name__ == '__main__':
    unittest.main()

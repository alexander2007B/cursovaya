"""Isolated Red/Green demonstration, outside the main 15-case suite."""
import json, os, subprocess

def test_phone_rejects_brackets_without_digits():
    module = os.environ.get('TDD_PHONE_MODULE', './shared/phone.js')
    code = f'''import {{normalizeRussianPhone}} from {json.dumps(module)};
try {{ normalizeRussianPhone("()()()()()"); console.log(false); }}
catch {{ console.log(true); }}'''
    result = subprocess.check_output(
        ['node', '--input-type=module', '-e', code], text=True)
    assert json.loads(result) is True

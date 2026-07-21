@echo off
node dist/cli.js scan src/good-fixture --format text --quiet
node dist/cli.js scan src/bad-fixture --format text --quiet
exit /b 0

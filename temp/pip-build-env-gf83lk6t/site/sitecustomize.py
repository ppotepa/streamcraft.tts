
import os, site, sys

# First, drop system-sites related paths.
original_sys_path = sys.path[:]
known_paths = set()
for path in {'d:\\git\\streamcraft.tts\\.venv-tts', 'd:\\git\\streamcraft.tts\\.venv-tts\\lib\\site-packages'}:
    site.addsitedir(path, known_paths=known_paths)
system_paths = set(
    os.path.normcase(path)
    for path in sys.path[len(original_sys_path):]
)
original_sys_path = [
    path for path in original_sys_path
    if os.path.normcase(path) not in system_paths
]
sys.path = original_sys_path

# Second, add lib directories.
# ensuring .pth file are processed.
for path in ['D:\\git\\streamcraft.tts\\temp\\pip-build-env-gf83lk6t\\overlay\\Lib\\site-packages', 'D:\\git\\streamcraft.tts\\temp\\pip-build-env-gf83lk6t\\normal\\Lib\\site-packages']:
    assert not path in sys.path
    site.addsitedir(path)

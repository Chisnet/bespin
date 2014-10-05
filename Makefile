# Setup -------------------------------------------------

install: venv

venv:
    virtualenv venv
    venv/bin/pip install -r pip-requirements.txt

# Cleanup -----------------------------------------------

clean: 
    rm -rf venv

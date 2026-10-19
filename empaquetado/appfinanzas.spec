# -*- mode: python -*-
# Receta de PyInstaller: convierte la app (Python + web compilada) en UN solo
# ejecutable que no necesita tener Python instalado.
#
# Uso (desde la raíz del repo, con la web ya compilada en frontend/dist):
#     pip install -r backend/requirements.txt -c backend/constraints.txt pyinstaller
#     pyinstaller empaquetado/appfinanzas.spec
# Resultado: dist/AppFinanzas(.exe)
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

RAIZ = Path(SPECPATH).parent  # SPECPATH: carpeta de este archivo (la define PyInstaller)

a = Analysis(
    [str(RAIZ / "backend" / "app" / "lanzador.py")],
    pathex=[str(RAIZ / "backend")],
    # La web compilada viaja dentro del ejecutable, en la carpeta "web".
    datas=[(str(RAIZ / "frontend" / "dist"), "web")],
    # uvicorn y nuestra app cargan módulos por nombre: PyInstaller no los ve solo.
    hiddenimports=collect_submodules("uvicorn") + collect_submodules("app"),
    excludes=["pytest", "tkinter"],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    name="AppFinanzas",
    # Con consola: esa ventana ES la app (al cerrarla se detiene) y muestra
    # dónde se guardan los datos.
    console=True,
    upx=False,  # UPX dispara más falsos positivos de antivirus
)

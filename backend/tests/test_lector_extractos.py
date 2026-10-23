"""Lectura de extractos bancarios con formatos de distintos bancos, sin configurar nada."""

import io
import zipfile
from datetime import date, datetime
from decimal import Decimal

import pytest
from openpyxl import Workbook

from app.services.errores import ReglaDeNegocioError
from app.services.lector_extractos import _a_importe, leer_extracto


def _resumen(contenido: bytes) -> list[tuple[date, str, str]]:
    return [(m.fecha, str(m.importe), m.concepto) for m in leer_extracto(contenido).movimientos]


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("1.234,56", "1234.56"),
        ("1,234.56", "1234.56"),
        ("-12,30", "-12.30"),
        ("12,30-", "-12.30"),
        ("(5.00)", "-5.00"),
        ("−7,5 €", "-7.50"),  # signo menos tipográfico
        ("$ 1,500.00 MXN", "1500.00"),
        ("1.234", "1234.00"),  # tres cifras tras el separador: son miles
        ("7.99", "7.99"),
        ("+20", "20.00"),
        ("Mercadona", None),
        ("", None),
    ],
)
def test_importes_en_cualquier_formato(texto: str, esperado: str | None) -> None:
    resultado = _a_importe(texto)
    assert (str(resultado) if resultado is not None else None) == esperado


def test_banco_espanol_con_titular_antes_de_la_tabla_y_latin1() -> None:
    """Separador `;`, coma decimal, fecha valor, saldo, y en Windows-1252 (no UTF-8)."""
    contenido = (
        "Titular;RODRIGO TARIN\n"
        "Cuenta;ES12 3456 7890\n"
        "\n"
        "F. Operación;F. Valor;Concepto;Importe;Saldo\n"
        "02/10/2026;03/10/2026;COMPRA TARJ. MERCADONA VALENCIA;-45,20;1.954,80\n"
        "01/10/2026;01/10/2026;Nómina Octubre;2.000,00;2.000,00\n"
        ";;Total;1.954,80;\n"
    ).encode("cp1252")
    extracto = leer_extracto(contenido)
    assert _resumen(contenido) == [
        (date(2026, 10, 2), "-45.20", "COMPRA TARJ. MERCADONA VALENCIA"),
        (date(2026, 10, 1), "2000.00", "Nómina Octubre"),
    ]
    assert extracto.columnas == {"fecha": "F. Operación", "concepto": "Concepto", "importe": "Importe"}
    assert extracto.filas_ignoradas == 1  # la línea de total
    assert extracto.movimientos[0].fila == 5


def test_banco_mexicano_con_cargo_y_abono_separados() -> None:
    contenido = (
        "Fecha,Descripción,Cargo,Abono,Saldo\n"
        '15/09/2026,OXXO REFORMA,"1,250.00",,"8,750.00"\n'
        '16/09/2026,SPEI RECIBIDO,,"10,000.00","18,750.00"\n'
    ).encode()
    assert _resumen(contenido) == [
        (date(2026, 9, 15), "-1250.00", "OXXO REFORMA"),
        (date(2026, 9, 16), "10000.00", "SPEI RECIBIDO"),
    ]


def test_revolut_mexico_fecha_de_inicio_y_comision_aparte() -> None:
    """Formato real de Revolut (datos inventados): dos fechas con hora y la comisión en `Fee`.

    La cuota del plan viene con importe 0 y todo en `Fee`: sin restarla se perdería el gasto.
    """
    contenido = (
        b"Type,Started Date,Completed Date,Description,Amount,Fee,Balance\n"
        b"CHARGE,2026-06-15 22:25:22,2026-06-15 22:25:22,Premium plan fee,0.00,99.00,-99.00\n"
        b"CARD_PAYMENT,2026-06-15 23:40:55,2026-06-17 07:50:21,Tienda Ejemplo,-150.50,0.00,-249.50\n"
        b"CARD_PAYMENT,2026-06-16 10:00:00,2026-06-18 09:00:00,Compra en USD,-100.00,2.50,-352.00\n"
        b"CARD_REFUND,2026-06-18 18:00:00,2026-06-20 05:53:08,Tienda Ejemplo,5.00,0.00,-347.00\n"
    )
    extracto = leer_extracto(contenido)
    assert _resumen(contenido) == [
        (date(2026, 6, 15), "-99.00", "Premium plan fee"),
        (date(2026, 6, 15), "-150.50", "Tienda Ejemplo"),  # la fecha de la compra, no la del cargo
        (date(2026, 6, 16), "-102.50", "Compra en USD"),
        (date(2026, 6, 18), "5.00", "Tienda Ejemplo"),
    ]
    assert extracto.columnas == {
        "fecha": "Started Date", "concepto": "Description", "importe": "Amount", "comision": "Fee",
    }


def test_csv_sin_cabecera_detecta_las_columnas_por_su_contenido() -> None:
    contenido = b"2026-10-05,Spotify,-10.99\n2026-10-06,Amazon Marketplace,-23.50\n2026-10-07,Bizum de Ana,15\n"
    assert _resumen(contenido) == [
        (date(2026, 10, 5), "-10.99", "Spotify"),
        (date(2026, 10, 6), "-23.50", "Amazon Marketplace"),
        (date(2026, 10, 7), "15.00", "Bizum de Ana"),
    ]


def test_fechas_con_mes_primero_se_reconocen_si_alguna_lo_aclara() -> None:
    contenido = b"Date,Description,Amount\n10/02/2026,Uber,-8.40\n10/25/2026,Refund,8.40\n"
    assert [m.fecha for m in leer_extracto(contenido).movimientos] == [date(2026, 10, 2), date(2026, 10, 25)]


def test_prefiere_el_concepto_a_la_referencia_aunque_vaya_antes() -> None:
    contenido = "Referencia;Fecha;Concepto;Importe\n000123;01/10/2026;Farmacia;-9,90\n".encode()
    assert _resumen(contenido) == [(date(2026, 10, 1), "-9.90", "Farmacia")]


def test_excel_con_fechas_y_numeros_nativos() -> None:
    libro = Workbook()
    hoja = libro.active
    hoja.append(["Últimos movimientos"])
    hoja.append([])
    hoja.append(["Fecha", "Concepto", "Importe (€)", "Saldo (€)"])
    hoja.append([datetime(2026, 10, 3), "Renfe Cercanías", -3.6, 996.4])
    hoja.append([datetime(2026, 10, 4), "Devolución", 12, 1008.4])
    archivo = io.BytesIO()
    libro.save(archivo)
    assert _resumen(archivo.getvalue()) == [
        (date(2026, 10, 3), "-3.60", "Renfe Cercanías"),
        (date(2026, 10, 4), "12.00", "Devolución"),
    ]


@pytest.mark.parametrize(
    ("contenido", "mensaje"),
    [
        (b"", "vacío"),
        (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1resto", ".xls antiguo"),
        (b"<html><table></table></html>", "página web"),
        (b"PK\x03\x04no es un zip de verdad", "dañado"),
        (b"Nombre,Apellido\nAna,Lopez\n", "columnas de fecha e importe"),
        (b"Fecha;Concepto;Importe\nTotal;;0\n", "ningún movimiento"),
    ],
)
def test_archivos_no_validos_dan_un_mensaje_claro(contenido: bytes, mensaje: str) -> None:
    with pytest.raises(ReglaDeNegocioError, match=mensaje):
        leer_extracto(contenido)


def test_importes_exactos_sin_errores_de_coma_flotante() -> None:
    contenido = b"Fecha;Concepto;Importe\n01/10/2026;Cafe;-0,10\n01/10/2026;Cafe;-0,20\n"
    assert sum(m.importe for m in leer_extracto(contenido).movimientos) == Decimal("-0.30")


def _zip(piezas: dict[str, bytes]) -> bytes:
    archivo = io.BytesIO()
    with zipfile.ZipFile(archivo, "w", zipfile.ZIP_DEFLATED) as zip_:
        for nombre, datos in piezas.items():
            zip_.writestr(nombre, datos)
    return archivo.getvalue()


@pytest.mark.parametrize(
    "piezas",
    [
        {"xl/sharedStrings.xml": b"0" * 25_000_000},  # pocos KB comprimido, 25 MB descomprimido
        {f"xl/pieza{i}.xml": b"" for i in range(201)},
    ],
    ids=["bomba-zip", "demasiadas-piezas"],
)
def test_excel_que_se_hincharia_al_abrirlo_se_rechaza_sin_descomprimir(piezas: dict[str, bytes]) -> None:
    contenido = _zip(piezas)
    assert len(contenido) < 100_000
    with pytest.raises(ReglaDeNegocioError, match="demasiado grande por dentro"):
        leer_extracto(contenido)

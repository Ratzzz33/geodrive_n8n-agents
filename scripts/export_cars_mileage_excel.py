from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[1]
CSV_PATH = BASE_DIR / "excel" / "данные_по_авто_1763131843.csv"
MERGED_BOOKINGS_PATH = BASE_DIR / "excel" / "Merge_All_Branches.json"
OUTPUT_PATH = BASE_DIR / "excel" / "cars_vin_year_mileage_partner.xlsx"


CAR_ID_PATTERN = re.compile(r"/cars/(\d+)")


def load_cars() -> pd.DataFrame:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Не найден исходный CSV: {CSV_PATH}")

    cars_df = pd.read_csv(
        CSV_PATH,
        sep=";",
        encoding="cp1251",
        dtype=str,
        index_col=False,
    )

    def extract_car_id(row: pd.Series) -> Any:
        for column in ("Кутаиси", "Тбилиси", "Батуми", "ЦРМ"):
            value = row.get(column)
            if not isinstance(value, str):
                continue
            match = CAR_ID_PATTERN.search(value)
            if match:
                return int(match.group(1))
        return pd.NA

    cars_df["car_id"] = cars_df.apply(extract_car_id, axis=1).astype("Int64")

    cars_df["VIN"] = cars_df["VIN"].fillna("").str.strip()
    cars_df["Год"] = cars_df["Год"].fillna("").astype(str).str.strip()
    cars_df["Авто"] = cars_df["Авто"].fillna("").str.strip()
    cars_df["Партнер"] = cars_df["Партнер"].fillna("").str.strip()

    return cars_df


def _extract_bookings_rows() -> list[dict[str, Any]]:
    if not MERGED_BOOKINGS_PATH.exists():
        raise FileNotFoundError(f"Не найден JSON с бронированиями: {MERGED_BOOKINGS_PATH}")

    with MERGED_BOOKINGS_PATH.open(encoding="utf-8") as fh:
        payload = json.load(fh)

    rows: list[dict[str, Any]] = []
    for block in payload:
        bookings = (
            block.get("json", {})
            .get("bookings", {})
            .get("data", [])
        )
        for booking in bookings:
            attrs = booking.get("attributes") or {}
            car_id = attrs.get("car_id")
            start_mileage = attrs.get("start_mileage")
            if car_id in (None, "") or start_mileage in (None, "", 0, "0"):
                continue
            try:
                car_id_int = int(car_id)
                mileage_value = int(float(start_mileage))
            except (ValueError, TypeError):
                continue
            if mileage_value <= 0:
                continue
            rows.append({"car_id": car_id_int, "mileage": mileage_value})
    return rows


def load_mileage() -> pd.DataFrame:
    rows = _extract_bookings_rows()
    if not rows:
        return pd.DataFrame(columns=["car_id", "mileage"])

    df = pd.DataFrame(rows)
    grouped = (
        df.groupby("car_id", as_index=False)["mileage"]
        .max()
        .rename(columns={"mileage": "Пробег, км"})
    )
    grouped["car_id"] = grouped["car_id"].astype("Int64")
    return grouped


def build_report() -> pd.DataFrame:
    cars_df = load_cars()
    mileage_df = load_mileage()

    merged = cars_df.merge(mileage_df, on="car_id", how="left")

    result = merged[
        ["Авто", "VIN", "Год", "Пробег, км", "Партнер"]
    ].copy()

    result = result.rename(
        columns={
            "Авто": "Автомобиль",
            "Год": "Год выпуска",
        }
    )
    result.sort_values(["Автомобиль", "VIN"], inplace=True, ignore_index=True)
    return result


def main() -> None:
    report_df = build_report()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    report_df.to_excel(OUTPUT_PATH, index=False)
    print(f"Saved {len(report_df)} rows to {OUTPUT_PATH}", flush=True)


if __name__ == "__main__":
    main()


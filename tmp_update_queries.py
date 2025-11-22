import json
import textwrap
from pathlib import Path

path = Path("n8n-workflows/rentprog-car-prices-daily.cleaned.json")
data = json.loads(path.read_text(encoding="utf-8"))


def update_query(name: str, template: str):
    for node in data["nodes"]:
        if node["name"] == name:
            node["parameters"]["query"] = template
            return True
    raise RuntimeError(f"Node {name} not found")


save_snapshot_sql = textwrap.dedent(
    """
    =INSERT INTO rentprog_car_states_snapshot AS tgt (
      branch_id, rentprog_id, car_name, code, number, vin, color, year, transmission,
      fuel, car_type, car_class, active, state, tank_state, clean_state, mileage,
      tire_type, tire_size, last_inspection, deposit, price_hour, hourly_deposit,
      monthly_deposit, investor_id, purchase_price, purchase_date, age_limit,
      driver_year_limit, franchise, max_fine, repair_cost, is_air, climate_control,
      parktronic, parktronic_camera, heated_seats, audio_system, usb_system,
      rain_sensor, engine_capacity, number_doors, tank_value, pts,
      registration_certificate, body_number, data
    )
    SELECT
      rec.branch_id, rec.rentprog_id, rec.car_name, rec.code, rec.number, rec.vin, rec.color, rec.year, rec.transmission,
      rec.fuel, rec.car_type, rec.car_class, rec.active, rec.state, rec.tank_state, rec.clean_state, rec.mileage,
      rec.tire_type, rec.tire_size, rec.last_inspection, rec.deposit, rec.price_hour, rec.hourly_deposit,
      rec.monthly_deposit, rec.investor_id, rec.purchase_price, rec.purchase_date, rec.age_limit,
      rec.driver_year_limit, rec.franchise, rec.max_fine, rec.repair_cost, rec.is_air, rec.climate_control,
      rec.parktronic, rec.parktronic_camera, rec.heated_seats, rec.audio_system, rec.usb_system,
      rec.rain_sensor, rec.engine_capacity, rec.number_doors, rec.tank_value, rec.pts,
      rec.registration_certificate, rec.body_number, rec.data
    FROM json_populate_record(NULL::rentprog_car_states_snapshot, '{{ JSON.stringify($json).replace(/'/g, "''") }}'::jsonb) AS rec
    ON CONFLICT (rentprog_id) DO UPDATE SET
      branch_id = COALESCE(EXCLUDED.branch_id, tgt.branch_id),
      car_name = COALESCE(EXCLUDED.car_name, tgt.car_name),
      code = COALESCE(EXCLUDED.code, tgt.code),
      number = COALESCE(EXCLUDED.number, tgt.number),
      vin = COALESCE(EXCLUDED.vin, tgt.vin),
      color = COALESCE(EXCLUDED.color, tgt.color),
      year = COALESCE(EXCLUDED.year, tgt.year),
      transmission = COALESCE(EXCLUDED.transmission, tgt.transmission),
      fuel = COALESCE(EXCLUDED.fuel, tgt.fuel),
      car_type = COALESCE(EXCLUDED.car_type, tgt.car_type),
      car_class = COALESCE(EXCLUDED.car_class, tgt.car_class),
      active = COALESCE(EXCLUDED.active, tgt.active),
      state = COALESCE(EXCLUDED.state, tgt.state),
      tank_state = COALESCE(EXCLUDED.tank_state, tgt.tank_state),
      clean_state = COALESCE(EXCLUDED.clean_state, tgt.clean_state),
      mileage = COALESCE(EXCLUDED.mileage, tgt.mileage),
      tire_type = COALESCE(EXCLUDED.tire_type, tgt.tire_type),
      tire_size = COALESCE(EXCLUDED.tire_size, tgt.tire_size),
      last_inspection = COALESCE(EXCLUDED.last_inspection, tgt.last_inspection),
      deposit = COALESCE(EXCLUDED.deposit, tgt.deposit),
      price_hour = COALESCE(EXCLUDED.price_hour, tgt.price_hour),
      hourly_deposit = COALESCE(EXCLUDED.hourly_deposit, tgt.hourly_deposit),
      monthly_deposit = COALESCE(EXCLUDED.monthly_deposit, tgt.monthly_deposit),
      investor_id = COALESCE(EXCLUDED.investor_id, tgt.investor_id),
      purchase_price = COALESCE(EXCLUDED.purchase_price, tgt.purchase_price),
      purchase_date = COALESCE(EXCLUDED.purchase_date, tgt.purchase_date),
      age_limit = COALESCE(EXCLUDED.age_limit, tgt.age_limit),
      driver_year_limit = COALESCE(EXCLUDED.driver_year_limit, tgt.driver_year_limit),
      franchise = COALESCE(EXCLUDED.franchise, tgt.franchise),
      max_fine = COALESCE(EXCLUDED.max_fine, tgt.max_fine),
      repair_cost = COALESCE(EXCLUDED.repair_cost, tgt.repair_cost),
      is_air = COALESCE(EXCLUDED.is_air, tgt.is_air),
      climate_control = COALESCE(EXCLUDED.climate_control, tgt.climate_control),
      parktronic = COALESCE(EXCLUDED.parktronic, tgt.parktronic),
      parktronic_camera = COALESCE(EXCLUDED.parktronic_camera, tgt.parktronic_camera),
      heated_seats = COALESCE(EXCLUDED.heated_seats, tgt.heated_seats),
      audio_system = COALESCE(EXCLUDED.audio_system, tgt.audio_system),
      usb_system = COALESCE(EXCLUDED.usb_system, tgt.usb_system),
      rain_sensor = COALESCE(EXCLUDED.rain_sensor, tgt.rain_sensor),
      engine_capacity = COALESCE(EXCLUDED.engine_capacity, tgt.engine_capacity),
      number_doors = COALESCE(EXCLUDED.number_doors, tgt.number_doors),
      tank_value = COALESCE(EXCLUDED.tank_value, tgt.tank_value),
      pts = COALESCE(EXCLUDED.pts, tgt.pts),
      registration_certificate = COALESCE(EXCLUDED.registration_certificate, tgt.registration_certificate),
      body_number = COALESCE(EXCLUDED.body_number, tgt.body_number),
      data = COALESCE(EXCLUDED.data, tgt.data);
    """
).strip()

update_query("Save Snapshot", save_snapshot_sql)

save_cars_sql = textwrap.dedent(
    """
    =WITH rec AS (
      SELECT *
      FROM json_populate_record(NULL::rentprog_car_states_snapshot, '{{ JSON.stringify($json).replace(/'/g, "''") }}'::jsonb)
    )
    INSERT INTO cars AS tgt (
      id, branch_id, rentprog_id, car_name, code, number, vin, color, year, transmission,
      fuel, car_type, car_class, active, state, tank_state, clean_state, mileage,
      tire_type, tire_size, last_inspection, deposit, price_hour, hourly_deposit,
      monthly_deposit, investor_id, purchase_price, purchase_date, age_limit,
      driver_year_limit, franchise, max_fine, repair_cost, is_air, climate_control,
      parktronic, parktronic_camera, heated_seats, audio_system, usb_system,
      rain_sensor, engine_capacity, number_doors, tank_value, pts,
      registration_certificate, body_number, data
    )
    SELECT
      COALESCE((SELECT id FROM cars WHERE rentprog_id = rec.rentprog_id LIMIT 1), gen_random_uuid()) AS id,
      rec.branch_id, rec.rentprog_id, rec.car_name, rec.code, rec.number, rec.vin, rec.color, rec.year, rec.transmission,
      rec.fuel, rec.car_type, rec.car_class, rec.active, rec.state, rec.tank_state, rec.clean_state, rec.mileage,
      rec.tire_type, rec.tire_size, rec.last_inspection, rec.deposit, rec.price_hour, rec.hourly_deposit,
      rec.monthly_deposit, rec.investor_id, rec.purchase_price, rec.purchase_date, rec.age_limit,
      rec.driver_year_limit, rec.franchise, rec.max_fine, rec.repair_cost, rec.is_air, rec.climate_control,
      rec.parktronic, rec.parktronic_camera, rec.heated_seats, rec.audio_system, rec.usb_system,
      rec.rain_sensor, rec.engine_capacity, rec.number_doors, rec.tank_value, rec.pts,
      rec.registration_certificate, rec.body_number, rec.data
    FROM rec
    ON CONFLICT (rentprog_id) DO UPDATE SET
      branch_id = COALESCE(EXCLUDED.branch_id, tgt.branch_id),
      car_name = COALESCE(EXCLUDED.car_name, tgt.car_name),
      code = COALESCE(EXCLUDED.code, tgt.code),
      number = COALESCE(EXCLUDED.number, tgt.number),
      vin = COALESCE(EXCLUDED.vin, tgt.vin),
      color = COALESCE(EXCLUDED.color, tgt.color),
      year = COALESCE(EXCLUDED.year, tgt.year),
      transmission = COALESCE(EXCLUDED.transmission, tgt.transmission),
      fuel = COALESCE(EXCLUDED.fuel, tgt.fuel),
      car_type = COALESCE(EXCLUDED.car_type, tgt.car_type),
      car_class = COALESCE(EXCLUDED.car_class, tgt.car_class),
      active = COALESCE(EXCLUDED.active, tgt.active),
      state = COALESCE(EXCLUDED.state, tgt.state),
      tank_state = COALESCE(EXCLUDED.tank_state, tgt.tank_state),
      clean_state = COALESCE(EXCLUDED.clean_state, tgt.clean_state),
      mileage = COALESCE(EXCLUDED.mileage, tgt.mileage),
      tire_type = COALESCE(EXCLUDED.tire_type, tgt.tire_type),
      tire_size = COALESCE(EXCLUDED.tire_size, tgt.tire_size),
      last_inspection = COALESCE(EXCLUDED.last_inspection, tgt.last_inspection),
      deposit = COALESCE(EXCLUDED.deposit, tgt.deposit),
      price_hour = COALESCE(EXCLUDED.price_hour, tgt.price_hour),
      hourly_deposit = COALESCE(EXCLUDED.hourly_deposit, tgt.hourly_deposit),
      monthly_deposit = COALESCE(EXCLUDED.monthly_deposit, tgt.monthly_deposit),
      investor_id = COALESCE(EXCLUDED.investor_id, tgt.investor_id),
      purchase_price = COALESCE(EXCLUDED.purchase_price, tgt.purchase_price),
      purchase_date = COALESCE(EXCLUDED.purchase_date, tgt.purchase_date),
      age_limit = COALESCE(EXCLUDED.age_limit, tgt.age_limit),
      driver_year_limit = COALESCE(EXCLUDED.driver_year_limit, tgt.driver_year_limit),
      franchise = COALESCE(EXCLUDED.franchise, tgt.franchise),
      max_fine = COALESCE(EXCLUDED.max_fine, tgt.max_fine),
      repair_cost = COALESCE(EXCLUDED.repair_cost, tgt.repair_cost),
      is_air = COALESCE(EXCLUDED.is_air, tgt.is_air),
      climate_control = COALESCE(EXCLUDED.climate_control, tgt.climate_control),
      parktronic = COALESCE(EXCLUDED.parktronic, tgt.parktronic),
      parktronic_camera = COALESCE(EXCLUDED.parktronic_camera, tgt.parktronic_camera),
      heated_seats = COALESCE(EXCLUDED.heated_seats, tgt.heated_seats),
      audio_system = COALESCE(EXCLUDED.audio_system, tgt.audio_system),
      usb_system = COALESCE(EXCLUDED.usb_system, tgt.usb_system),
      rain_sensor = COALESCE(EXCLUDED.rain_sensor, tgt.rain_sensor),
      engine_capacity = COALESCE(EXCLUDED.engine_capacity, tgt.engine_capacity),
      number_doors = COALESCE(EXCLUDED.number_doors, tgt.number_doors),
      tank_value = COALESCE(EXCLUDED.tank_value, tgt.tank_value),
      pts = COALESCE(EXCLUDED.pts, tgt.pts),
      registration_certificate = COALESCE(EXCLUDED.registration_certificate, tgt.registration_certificate),
      body_number = COALESCE(EXCLUDED.body_number, tgt.body_number),
      data = COALESCE(EXCLUDED.data, tgt.data),
      updated_at = NOW();
    """
).strip()

update_query("Save Cars", save_cars_sql)

normalize_code = textwrap.dedent(
    """
    =String.raw`const results = [];
    const stats = { branches: {}, cars: 0 };

    for (const item of $input.all()) {
      const branchCode = item.json.branch_code || item.json.branch;
      const branchId = item.json.branch_id;
      const responseData = item.json.cars ?? item.json;

      if (!stats.branches[branchCode]) {
        stats.branches[branchCode] = { cars: 0 };
      }

      let cars = [];
      if (Array.isArray(responseData)) {
        cars = responseData;
      } else if (Array.isArray(responseData.data)) {
        cars = responseData.data;
      } else if (Array.isArray(responseData.cars)) {
        cars = responseData.cars;
      } else if (Array.isArray(responseData.response)) {
        cars = responseData.response;
      } else if (responseData && typeof responseData === 'object') {
        cars = [responseData];
      }

      stats.cars += cars.length;
      stats.branches[branchCode].cars += cars.length;

      for (const car of cars) {
        const attrs = car.attributes || car;

        results.push({ json: {
          branch_code: branchCode,
          branch_id: branchId,
          rentprog_id: String(attrs.id || car.id),
          car_name: attrs.car_name || attrs.name || null,
          code: attrs.code || null,
          number: attrs.number || null,
          vin: attrs.vin || null,
          color: attrs.color || null,
          year: attrs.year ?? null,
          transmission: attrs.transmission || null,
          fuel: attrs.fuel || null,
          car_type: attrs.car_type || null,
          car_class: attrs.car_class || null,
          active: attrs.active,
          state: attrs.state,
          tank_state: attrs.tank_state,
          clean_state: attrs.clean_state,
          mileage: attrs.mileage,
          tire_type: attrs.tire_type,
          tire_size: attrs.tire_size || null,
          last_inspection: attrs.last_inspection || null,
          deposit: attrs.deposit,
          price_hour: attrs.price_hour,
          hourly_deposit: attrs.hourly_deposit,
          monthly_deposit: attrs.monthly_deposit,
          investor_id: attrs.investor_id,
          purchase_price: attrs.purchase_price,
          purchase_date: attrs.purchase_date,
          age_limit: attrs.age_limit,
          driver_year_limit: attrs.driver_year_limit,
          franchise: attrs.franchise,
          max_fine: attrs.max_fine,
          repair_cost: attrs.repair_cost,
          is_air: attrs.is_air,
          climate_control: attrs.climate_control,
          parktronic: attrs.parktronic,
          parktronic_camera: attrs.parktronic_camera,
          heated_seats: attrs.heated_seats,
          audio_system: attrs.audio_system,
          usb_system: attrs.usb_system,
          rain_sensor: attrs.rain_sensor,
          engine_capacity: attrs.engine_capacity,
          number_doors: attrs.number_doors,
          tank_value: attrs.tank_value,
          pts: attrs.pts,
          registration_certificate: attrs.registration_certificate,
          body_number: attrs.body_number,
          data: attrs
        } });
      }
    }

    const staticData = $getWorkflowStaticData('global');
    staticData.carStats = stats;

    if (!results.length) results.push({ json: { __statsOnly: true } });

    return results;`
    """
).strip()

for node in data["nodes"]:
    if node["name"] == "Normalize Cars":
        node["parameters"]["jsCode"] = normalize_code
        break

for node in data["nodes"]:
    if node["name"] == "Send Alert":
        node["parameters"] = {
            "operation": "sendMessage",
            "chatId": {
                "__rl": True,
                "mode": "expression",
                "value": "={{ $env.TELEGRAM_ALERT_CHAT_ID }}"
            },
            "text": "={{ $json.message + \"\\n\\n🔗 <a href=\\\"https://n8n.rentflow.rentals/workflow/\" + $workflow.id + \"/executions/\" + $execution.id + \"\\\">Открыть execution</a>\" }}",
            "additionalFields": {
                "appendAttribution": False,
                "parse_mode": "HTML"
            }
        }
        break


path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


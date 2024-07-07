import configparser
import psycopg2
import re
import time
import lxml.etree as ET
from util import print_progress_bar, estimate_seconds_to_completion
from datetime import datetime, timedelta

config = configparser.ConfigParser()
config.read("import.conf")

conn = psycopg2.connect(
  dbname = config['database']['dbname'],
  user = config['database']['user'],
  password = config['database']['password'],
  host = config['database']['host'],
  port = config['database']['port']
)

db = conn.cursor()

table_name = config['import']['table_name']
view_name = config['import']['summary_view_name']

print("db cleanup")
db.execute(f"DROP MATERIALIZED VIEW IF EXISTS {view_name};")
db.execute(f"DROP TABLE IF EXISTS {table_name};")

print(f"creating table {table_name}")
db.execute(f"""
  CREATE TABLE IF NOT EXISTS {table_name} (
      id SERIAL PRIMARY KEY,                  
      vehicle_id VARCHAR(20),  
      timestamp TIMESTAMP,       
      simulation_step INTEGER,
      type VARCHAR(50),                       
      speed DECIMAL(5, 2),
      angle FLOAT,              
      lane BIGINT,                               
      position GEOMETRY(Point, 3857)
  )""")

if (not config['import'].getboolean('skip_index_creation')):
  print(f"creating index {table_name}_vehicle_id_idx")
  db.execute(f"CREATE INDEX {table_name}_vehicle_id_idx ON {table_name} (vehicle_id);")

  print(f"creating index {table_name}_position_idx")
  db.execute(f"CREATE INDEX {table_name}_position_idx ON {table_name} (position);")

  print(f"creating index {table_name}_lane_idx")
  db.execute(f"CREATE INDEX {table_name}_lane_idx ON {table_name} (lane);")
  
  print(f"creating index {table_name}_timestamp_idx")
  db.execute(f"CREATE INDEX {table_name}_timestamp_idx ON {table_name} (timestamp);")
else:
  print('skipping index creation')

insert_query = f"""
    INSERT INTO {table_name} (vehicle_id, timestamp, simulation_step, type, speed, angle, lane, position)
      VALUES (%s, %s, %s, %s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 3857))
            """

print("collecting data")
file_path = config['file']['path']
with open(file_path, 'r') as fin:
  data_count = sum(line.count('<vehicle id') for line in fin)

context = ET.iterparse(source=file_path, events=("end",), tag="timestep")

start_time_str = config['import']['from_time']
virtual_timestamp = datetime.strptime(start_time_str, '%Y-%m-%d %H:%M:%S')

imported = 0
timestep_iteration = 0
import_start_time = time.time()
print("importing data")
for (event, timestep) in []:
  sim_time = float(timestep.attrib['time'])
  timestamp = virtual_timestamp + timedelta(seconds=int(sim_time))  
  
  batch = []
  for vehicle in timestep:
    match = re.search(r'^-?\d+', vehicle.attrib['lane'])
    veh_lane = abs(int(match.group(0))) if match else None
    veh_id = vehicle.attrib['id']
    veh_lat = vehicle.attrib['y']
    veh_lon = vehicle.attrib['x']
    veh_angle = vehicle.attrib['angle']
    veh_type = vehicle.attrib['type']
    veh_speed = round(float(vehicle.attrib['speed']) * 3.6, 2)
    
    batch.append((veh_id, timestamp, sim_time, veh_type, veh_speed, veh_angle, veh_lane, veh_lon, veh_lat))
    
  db.executemany(insert_query, batch)
  
  imported += len(batch)
  if (timestep_iteration % 60 == 0):
    etc_seconds = estimate_seconds_to_completion(import_start_time, imported, data_count)
    estimated_time = datetime.now() + timedelta(seconds=etc_seconds)
  timestep_iteration += 1
  
  print_progress_bar(imported, data_count, prefix='Progress: ', suffix=f"Estimation: {estimated_time.strftime('%H:%M')}", decimals=2, length=50)
  
  timestep.clear()

print("commiting insert") 
conn.commit()
print(f"import of {imported} records completed in {time.time() - import_start_time} seconds")

print("creating summary materialized view")

db.execute(f"""
CREATE MATERIALIZED VIEW {view_name} AS
SELECT
  vehicle_id,
  "type" as vehicle_type,
  ROUND(AVG(speed)::numeric, 2) avg_speed,
  MAX(speed) max_speed,
  MIN(timestamp) as departure_timestamp,
  MAX(timestamp) as arrival_timestamp,
  MIN(simulation_step) as departure_simulation_step,
  MAX(simulation_step) as arrival_simulation_step,
  EXTRACT(EPOCH FROM age(MAX(timestamp), MIN(timestamp))) as travel_duration,
  ROUND((ST_Length(ST_Transform(ST_MakeLine(ST_SetSRID(position, 3857) ORDER BY timestamp), 3857))::numeric) / 1000.0, 3) as route_length,
  ST_SetSRID(ST_MakeLine(ST_SetSRID(position, 3857) ORDER BY timestamp), 3857) as route
FROM
  {table_name} x
GROUP BY
  vehicle_id,
  "type";
""")

conn.commit()

print(f"creating index {table_name}_simulation_step_idx")
db.execute(f"CREATE INDEX {table_name}_simulation_step_idx ON {table_name} (simulation_step);")

if (not config['import'].getboolean('skip_index_creation')):
  print(f"creating index {view_name}_vehicle_id_idx")
  db.execute(f"CREATE INDEX {view_name}_vehicle_id_idx ON {view_name} (vehicle_id);")
  
  print(f"creating index {view_name}_departure_simulation_step_idx")
  db.execute(f"CREATE INDEX {view_name}_departure_simulation_step_idx ON {view_name} (departure_simulation_step);")
  
conn.commit()
print("operations completed")
import configparser
import psycopg2
import re
import lxml.etree as ET
from util import print_progress_bar
from datetime import datetime, timedelta, timezone

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
import_strategy = config['import']['strategy']
batch_size = config['import'].getint('batch_size')

print("db cleanup")
db.execute(f"DROP TABLE IF EXISTS {table_name};")

print(f"creating table {table_name}")
db.execute(f"""
  CREATE TABLE IF NOT EXISTS {table_name} (
      id SERIAL PRIMARY KEY,                  
      vehicle_id VARCHAR(20),  
      timestamp TIMESTAMP,                 
      type VARCHAR(50),                       
      speed FLOAT,
      angle FLOAT,              
      lane BIGINT,                               
      geom GEOMETRY(Point, 4326)
  )""")

if (not config['import'].getboolean('skip_index_creation')):
  print(f"creating index {table_name}_vehicle_id_idx")
  db.execute(f"CREATE INDEX {table_name}_vehicle_id_idx ON {table_name} (vehicle_id);")

  print(f"creating index {table_name}_geom_idx")
  db.execute(f"CREATE INDEX {table_name}_geom_idx ON {table_name} (geom);")

  print(f"creating index {table_name}_lane_idx")
  db.execute(f"CREATE INDEX {table_name}_lane_idx ON {table_name} (lane);")
  
  print(f"creating index {table_name}_lane_idx")
  db.execute(f"CREATE INDEX {table_name}_timestamp_idx ON {table_name} (timestamp);")
else:
  print('skipping index creation')

insert_query = f"""
    INSERT INTO {table_name} (vehicle_id, timestamp, type, speed, angle, lane, geom)
      VALUES (%s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
            """

if import_strategy == 'incremental':
  conn.commit()

file_path = config['file']['path']
with open(file_path, 'r') as fin:
  data_count = sum(line.count('<vehicle id') for line in fin)

context = ET.iterparse(source=file_path, events=("end",), tag="timestep")

current_time_utc = datetime.now(timezone.utc)

imported = 0
current_batch = 1
print("importing data")
for (event, timestep) in context:
  sim_time = float(timestep.attrib['time'])
  timestamp = current_time_utc + timedelta(seconds=int(sim_time))  
  
  for vehicle in timestep:
    match = re.search(r'^-?\d+', vehicle.attrib['lane'])
    veh_lane = abs(int(match.group(0))) if match else None
    veh_id = vehicle.attrib['id']
    veh_lat = vehicle.attrib['y']
    veh_lon = vehicle.attrib['x']
    veh_angle = vehicle.attrib['angle']
    veh_type = vehicle.attrib['type']
    veh_speed = vehicle.attrib['speed']
    
    imported += 1
    db.execute(insert_query, (veh_id, timestamp, veh_type, veh_speed, veh_angle, veh_lane, veh_lon, veh_lat))    
         
  if import_strategy == 'incremental' and (current_batch * batch_size < imported):
    current_batch += 1
    conn.commit() 
    
  print_progress_bar(imported, data_count, prefix='Progress: ', decimals=2, length=50)
  
  timestep.clear()
 
print("commiting insert") 
conn.commit()
print("operations completed")
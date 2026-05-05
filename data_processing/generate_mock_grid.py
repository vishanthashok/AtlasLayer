import csv
import random

# Bounding box for a sample agricultural area (e.g., California Central Valley roughly)
# You can change these coordinates to focus on a different area
LAT_MIN = 36.0
LAT_MAX = 38.0
LON_MIN = -121.0
LON_MAX = -119.0

# Number of grid points per degree (e.g., 100 means a point every 0.01 degrees)
RESOLUTION = 50

# Output file
OUTPUT_FILE = 'mock_grid_data.csv'

# Soil types
SOIL_TYPES = ['Loam', 'Sandy Loam', 'Clay Loam', 'Silt', 'Peat', 'Chalky']

def generate_mock_data():
    lat_step = 1.0 / RESOLUTION
    lon_step = 1.0 / RESOLUTION

    points = []
    
    lat = LAT_MIN
    while lat <= LAT_MAX:
        lon = LON_MIN
        while lon <= LON_MAX:
            # Generate somewhat realistic correlated data based on lat/lon variations
            # Just random for MVP, but with some geographic bias for effect
            rainfall_base = 20.0 + (lat - LAT_MIN) * 10 - (lon - LON_MIN) * 5
            temp_base = 60.0 - (lat - LAT_MIN) * 5 + (lon - LON_MIN) * 2
            
            rainfall_avg = max(5.0, min(80.0, rainfall_base + random.uniform(-10, 10)))
            temp_avg = max(40.0, min(100.0, temp_base + random.uniform(-15, 15)))
            
            # Soil type has a spatial distribution (using modulo for simple clustering)
            soil_index = int((lat * 10 + lon * 10) % len(SOIL_TYPES))
            soil_type = SOIL_TYPES[soil_index]
            
            # Drought frequency is higher where rainfall is lower and temp is higher
            drought_base = (temp_avg / 100.0) * 2 + (80.0 / rainfall_avg)
            drought_frequency = max(0.0, min(5.0, drought_base + random.uniform(-1, 1)))

            points.append({
                'geom': f"POINT({lon} {lat})",
                'lat': lat,
                'lon': lon,
                'rainfall_avg': round(rainfall_avg, 2),
                'temp_avg': round(temp_avg, 2),
                'soil_type': soil_type,
                'drought_frequency': round(drought_frequency, 2)
            })
            
            lon += lon_step
        lat += lat_step
        
    return points

def save_to_csv(points, filename):
    with open(filename, mode='w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=['geom', 'lat', 'lon', 'rainfall_avg', 'temp_avg', 'soil_type', 'drought_frequency'])
        writer.writeheader()
        writer.writerows(points)
    print(f"Generated {len(points)} grid points and saved to {filename}")

if __name__ == "__main__":
    points = generate_mock_data()
    save_to_csv(points, OUTPUT_FILE)

import React, { memo } from 'react'; // <<< FIX 1: Import memo
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet marker icon issue with Webpack/Vite
// Use require for image assets if using Webpack/Create React App, or ensure Vite handles static assets correctly.
// For simplicity and broad compatibility, using unpkg links is often fine for these defaults.
delete L.Icon.Default.prototype._getIconUrl; // Use delete instead of assigning null/undefined
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', // Updated URL if needed
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',       // Updated URL if needed
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',     // Updated URL if needed
});

const containerStyle = {
    width: '100%',
    height: '100%', // Ensure parent has defined height
    borderRadius: '1rem', // rounded-2xl
    zIndex: 0, // Ensure map is below other elements like modals if necessary
};

// <<< FIX 1 (PERFORMANCE): Wrap component in memo >>>
const MapComponent = memo(({ center, markers }) => {
    // Basic validation for center prop
    const mapCenter = Array.isArray(center) && center.length === 2 ? center : [13.7563, 100.5018]; // Default to Bangkok

    return (
        // Ensure the container div has a defined height, otherwise the map might not render
        <MapContainer center={mapCenter} zoom={12} scrollWheelZoom={true} style={containerStyle}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* <<< FIX 2 (ROBUSTNESS): Add validation for marker data >>> */}
            {Array.isArray(markers) && markers.map((marker) => {
                // Validate coordinates before rendering marker
                if (
                    !marker ||
                    !marker.coords ||
                    !Array.isArray(marker.coords) ||
                    marker.coords.length !== 2 ||
                    typeof marker.coords[0] !== 'number' ||
                    typeof marker.coords[1] !== 'number'
                ) {
                    console.warn('Invalid marker data skipped:', marker);
                    return null; // Skip rendering this marker if coords are invalid
                }

                // Use a stable and unique key
                const markerKey = marker.id ? `${marker.type || 'marker'}-${marker.id}` : `marker-${marker.coords[0]}-${marker.coords[1]}`;

                return (
                    <Marker key={markerKey} position={marker.coords}>
                        <Popup>
                            {/* Ensure name exists */}
                            {marker.name && <b>{marker.name}</b>}
                            {/* Add line break only if both name and description exist */}
                            {marker.name && marker.description && <br />}
                            {/* Ensure description exists */}
                            {marker.description || ''}
                        </Popup>
                    </Marker>
                );
            })}
            {/* <<< END FIX 2 >>> */}
        </MapContainer>
    );
}); // <<< END FIX 1 (memo) >>>

export default MapComponent;
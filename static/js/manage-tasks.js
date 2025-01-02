let map;
let selectedLocation = null;
let markers = [];
let userLocationMarker = null;

function updateLocationStatus(message, isError = false) {
    const statusElement = document.getElementById('locationStatus');
    statusElement.textContent = message;
    statusElement.style.display = 'block';
    if (isError) {
        statusElement.classList.add('error-message');
    } else {
        statusElement.classList.remove('error-message');
    }
    if (!isError) {
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }
}

function requestLocationPermission() {
    updateLocationStatus('Requesting location permission...');

    if (!navigator.geolocation) {
        updateLocationStatus('Geolocation is not supported by your browser', true);
        return;
    }

    navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
        if (result.state === 'denied') {
            updateLocationStatus('Location access was denied. Please enable location services in your browser settings.', true);
        } else {
            startLocationTracking();
        }
    });
}

function startLocationTracking() {
    updateLocationStatus('Detecting your location...');

    const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        position => {
            const { latitude, longitude, accuracy } = position.coords;
            updateLocationStatus(`Location found (accuracy: ${accuracy.toFixed(0)}m)`);

            if (userLocationMarker) {
                map.removeLayer(userLocationMarker);
            }

            userLocationMarker = L.marker([latitude, longitude], {
                title: 'Your Location',
                zIndexOffset: 1000
            }).addTo(map);

            userLocationMarker.bindPopup('Your current location').openPopup();
            map.setView([latitude, longitude], 15);
        },
        error => {
            let errorMessage = 'Unable to retrieve your location. ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Please enable location access in your browser settings.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out.';
                    break;
                default:
                    errorMessage += 'An unknown error occurred.';
            }
            updateLocationStatus(errorMessage, true);
        },
        options
    );
}

function initializeMap(lat, lon) {
    map = L.map('map').setView([52.237, 21.061], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    L.Control.geocoder({
        defaultMarkGeocode: false
    })
        .on('markgeocode', function(e) {
            const bbox = e.geocode.bbox;
            map.fitBounds(bbox);
            const center = bbox.getCenter();
            L.marker(center).addTo(map);
        })
        .addTo(map);

    loadTasks();

    map.on('click', (e) => {
        selectedLocation = e.latlng;
        document.getElementById('taskForm').style.display = 'block';
        document.getElementById('taskName').focus();

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
        document.getElementById('taskDueTime').value = tomorrow.toISOString().slice(0, 16);
    });
}

async function loadTasks() {
    try {
        const response = await fetch('/tasks');
        const tasks = await response.json();

        markers.forEach(marker => {
            if (!marker.isUserLocation) {
                map.removeLayer(marker);
            }
        });
        markers = markers.filter(m => m.isUserLocation);

        const tableBody = document.getElementById('tasksTableBody');
        tableBody.innerHTML = '';

        tasks.forEach(task => {
            const marker = L.marker([task.lat, task.lon])
                .addTo(map)
                .bindPopup(`${task.name}<br>Due: ${new Date(task.due_time).toLocaleString()}`);
            markers.push(marker);

            const isOverdue = new Date(task.due_time) < new Date();

            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${task.name}</td>
                <td class="${isOverdue ? 'overdue' : ''}">${new Date(task.due_time).toLocaleString()}</td>
                <td>${task.lat.toFixed(6)}</td>
                <td>${task.lon.toFixed(6)}</td>
                <td>
                    <button class="action-button show-button" onclick="centerOnTask(${task.lat}, ${task.lon})">
                        Show
                    </button>
                    <button class="action-button delete-button" onclick="deleteTask('${task.id}')">
                        Delete
                    </button>
                    <button class="action-button completed-button" onclick="completeTask('${task.id}')">
                        Complete
                    </button>                  
                </td>
            `;
        });
    } catch (error) {
        updateLocationStatus('Error loading tasks. Please refresh the page.', true);
    }
}

async function completeTask(taskId) {
    try {
        // Fetch the task details
        const taskResponse = await fetch('/tasks');
        const tasks = await taskResponse.json();
        const task = tasks.find(t => t.id === taskId);

        if (!task) {
            alert('Task not found');
            return;
        }

        // Send task to complete endpoint
        const completeResponse = await fetch('/complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(task)
        });

        const result = await completeResponse.json();

        if (completeResponse.ok && result.status === 'success') {
            await loadTasks(); // Refresh the task list
        } else {
            alert('Error completing task: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        alert('Error completing task. Please try again.');
        console.error('Error:', error);
    }
}
async function deleteTask(taskId) {
    try {
        const response = await fetch('/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: taskId })
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            await loadTasks();
        } else {
            alert('Error deleting task: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        alert('Error deleting task. Please try again.');
    }
}

function centerOnTask(lat, lon) {
    map.setView([lat, lon], 15);
    markers.forEach(marker => {
        if (marker.getLatLng().lat === lat && marker.getLatLng().lng === lon) {
            marker.openPopup();
        }
    });
}

async function saveTask() {
    const taskName = document.getElementById('taskName').value.trim();
    const taskDueTime = document.getElementById('taskDueTime').value;

    if (!taskName) {
        alert('Please enter a task name');
        return;
    }
    if (!taskDueTime) {
        alert('Please select a due time');
        return;
    }

    try {
        const response = await fetch('/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: taskName,
                lat: selectedLocation.lat,
                lon: selectedLocation.lng,
                due_time: taskDueTime
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            loadTasks();
            cancelTask();
        }
    } catch (error) {
        alert('Error saving task. Please try again.');
    }
}

function cancelTask() {
    document.getElementById('taskForm').style.display = 'none';
    document.getElementById('taskName').value = '';
    document.getElementById('taskDueTime').value = '';
    selectedLocation = null;
}


// Add this to your manage-tasks.js
function updateTrackingStatus(isTracking) {
    const statusElement = document.getElementById('trackingStatus');
    if (statusElement) {
        statusElement.textContent = isTracking ? 'Location tracking active' : 'Location tracking inactive';
        statusElement.className = isTracking ? 'status-active' : 'status-inactive';
    }
}

function toggleLocationTracking() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: document.getElementById('trackingToggle').checked ? 'START_TRACKING' : 'STOP_TRACKING'
        });
    }
}

// Add this when the page loads
window.addEventListener('load', () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'GET_STATUS' });
    }
});

navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data) {
        switch (event.data.type) {
            case 'TRACKING_STATUS':
                document.getElementById('trackingToggle').checked = event.data.isTracking;
                updateTrackingStatus(event.data.isTracking);
                break;
            case 'TRACKING_STARTED':
                updateTrackingStatus(true);
                break;
            case 'TRACKING_STOPPED':
                updateTrackingStatus(false);
                break;
        }
    }
});

initializeMap(0, 0);
requestLocationPermission();
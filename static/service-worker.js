const DATA_URL = '/data.json'; // URL to your data.json file

// Function to fetch and check the data
async function checkDueTimes() {
  try {
    // Fetch the data.json file
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }

    // Parse the JSON data
    const tasks = await response.json();

    // Get the current time
    const now = new Date();

    // Iterate through each task
    tasks.forEach(task => {
      const dueTime = new Date(task.due_time);

      // Calculate the difference in milliseconds
      const timeDifference = dueTime - now;

      // Check if the due time is less than 30 minutes from now
      if (timeDifference > 0 && timeDifference <= 30 * 60 * 1000) {
        // Show a notification
        showNotification(task);
      }
    });
  } catch (error) {
    console.error('Error fetching or processing data:', error);
  }
}

// Function to show a notification
function showNotification(task) {
  self.registration.showNotification('Task Reminder', {
    body: `Task "${task.name}" is due soon!`,
    icon: '/icons/icon-192x192.png', // Replace with your icon path
    badge: '/icons/icon-192x192.png' // Replace with your badge path
  });
}

// Periodically check the due times (e.g., every 5 minutes)
setInterval(checkDueTimes, 1 * 60 * 1000);

// Initial check when the service worker is activated
self.addEventListener('activate', event => {
  event.waitUntil(checkDueTimes());
});
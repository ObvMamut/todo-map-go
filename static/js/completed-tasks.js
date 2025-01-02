async function loadCompletedTasks() {
    try {
        const response = await fetch('/completed-data.json'); // Changed endpoint to fetch from JSON file
        const tasks = await response.json();

        const tableBody = document.getElementById('completedTasksTableBody');
        tableBody.innerHTML = '';

        tasks.forEach(task => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${task.name}</td>
                <td>${new Date(task.due_time).toLocaleString()}</td>
                <td>${task.lat.toFixed(6)}</td>
                <td>${task.lon.toFixed(6)}</td>
            `;
        });
    } catch (error) {
        console.error('Error loading completed tasks:', error);
        // Add user-friendly error message
        const tableBody = document.getElementById('completedTasksTableBody');
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="error-message">
                    Failed to load completed tasks. Please try again later.
                </td>
            </tr>
        `;
    }
}

// Load tasks when the page loads
document.addEventListener('DOMContentLoaded', loadCompletedTasks);
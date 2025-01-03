document.addEventListener('DOMContentLoaded', function() {
    // Get reference to the table body
    const tableBody = document.getElementById('completedTasksTableBody');

    // Fetch the completed tasks data
    fetch('/completed-data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Clear the loading message
            tableBody.innerHTML = '';

            // Check if data is empty
            if (!data || data.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="error-message">No completed tasks found.</td>
                    </tr>`;
                return;
            }

            // Add each task to the table
            data.forEach(task => {
                const row = document.createElement('tr');

                // Format the date to be more readable
                const dueDate = new Date(task.due_time);
                const formattedDate = dueDate.toLocaleString();

                row.innerHTML = `
                    <td>${task.name}</td>
                    <td>${formattedDate}</td>
                    <td>${task.lat}</td>
                    <td>${task.lon}</td>
                `;

                tableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error fetching completed tasks:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="error-message">
                        Error loading completed tasks. Please try again later.
                    </td>
                </tr>`;
        });
});
async function loadCompletedTasks() {
    try {
        const response = await fetch('/completed-tasks');
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
    }
}

loadCompletedTasks();
package main

import (
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"io/ioutil"
	"log"
	"net/http"
)

type Task struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Lat     float64 `json:"lat"`
	Lon     float64 `json:"lon"`
	DueTime string  `json:"due_time"`
}

type TaskInput struct {
	Name    string  `json:"name"`
	Lat     float64 `json:"lat"`
	Lon     float64 `json:"lon"`
	DueTime string  `json:"due_time"`
}

type DeleteTask struct {
	ID string `json:"id"`
}

func saveTask(w http.ResponseWriter, r *http.Request) {
	var input TaskInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Read existing tasks
	var tasks []Task
	data, err := ioutil.ReadFile("data.json")
	if err == nil {
		json.Unmarshal(data, &tasks)
	}

	// Create new task
	newTask := Task{
		ID:      uuid.New().String(),
		Name:    input.Name,
		Lat:     input.Lat,
		Lon:     input.Lon,
		DueTime: input.DueTime,
	}

	// Add to tasks
	tasks = append(tasks, newTask)

	// Save to file
	jsonData, err := json.MarshalIndent(tasks, "", "    ")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := ioutil.WriteFile("data.json", jsonData, 0644); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func deleteTask(w http.ResponseWriter, r *http.Request) {
	var input DeleteTask
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Read existing tasks
	var tasks []Task
	data, err := ioutil.ReadFile("data.json")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := json.Unmarshal(data, &tasks); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Find and remove task
	found := false
	newTasks := []Task{}
	for _, task := range tasks {
		if task.ID != input.ID {
			newTasks = append(newTasks, task)
		} else {
			found = true
		}
	}

	if !found {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "error",
			"message": "Task not found",
		})
		return
	}

	// Save updated tasks
	jsonData, err := json.MarshalIndent(newTasks, "", "    ")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := ioutil.WriteFile("data.json", jsonData, 0644); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func getTasks(w http.ResponseWriter, r *http.Request) {
	var tasks []Task
	data, err := ioutil.ReadFile("data.json")
	if err == nil {
		json.Unmarshal(data, &tasks)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

func main() {
	router := mux.NewRouter()

	// API routes
	router.HandleFunc("/save", saveTask).Methods("POST")
	router.HandleFunc("/delete", deleteTask).Methods("POST")
	router.HandleFunc("/tasks", getTasks).Methods("GET")

	// Serve static files
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("static")))

	// Start HTTPS server
	fmt.Println("Starting server on https://0.0.0.0:8443")
	log.Fatal(http.ListenAndServeTLS(":8443", "cert.crt", "cert.key", router))
}

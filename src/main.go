package main

import (
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"io/ioutil"
	"log"
	"net/http"
	"strings"
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

func completeTask(w http.ResponseWriter, r *http.Request) {
	var input Task
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Read completed tasks
	var completedTasks []Task
	completedData, err := ioutil.ReadFile("completed-data.json")
	if err == nil {
		json.Unmarshal(completedData, &completedTasks)
	}

	// Add to completed tasks
	completedTasks = append(completedTasks, input)

	// Save to completed-data.json
	jsonData, err := json.MarshalIndent(completedTasks, "", "    ")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := ioutil.WriteFile("completed-data.json", jsonData, 0644); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Delete from active tasks
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

	// Remove the task from active tasks
	newTasks := []Task{}
	for _, task := range tasks {
		if task.ID != input.ID {
			newTasks = append(newTasks, task)
		}
	}

	// Save updated active tasks
	jsonData, err = json.MarshalIndent(newTasks, "", "    ")
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

func addSecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Add security headers
		w.Header().Set("X-Content-Type-Options", "nosniff")

		// Set correct MIME type for JavaScript files
		if strings.HasSuffix(r.URL.Path, ".js") {
			w.Header().Set("Content-Type", "application/javascript")
		}

		next.ServeHTTP(w, r)
	})
}

func saveLocation(w http.ResponseWriter, r *http.Request) {
	var location struct {
		Lat       float64 `json:"lat"`
		Lon       float64 `json:"lon"`
		Timestamp string  `json:"timestamp"`
	}

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		log.Printf("Error reading request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := json.Unmarshal(body, &location); err != nil {
		log.Printf("Error decoding location JSON: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("[%s] Background location update from %s: Lat: %f, Lon: %f",
		location.Timestamp,
		r.RemoteAddr,
		location.Lat,
		location.Lon)

	w.WriteHeader(http.StatusOK)
}

func main() {
	router := mux.NewRouter()

	// API routes
	router.HandleFunc("/save", saveTask).Methods("POST")
	router.HandleFunc("/delete", deleteTask).Methods("POST")
	router.HandleFunc("/tasks", getTasks).Methods("GET")
	router.HandleFunc("/complete", completeTask).Methods("POST")
	router.HandleFunc("/location", saveLocation).Methods("POST")

	// Add headers middleware inline
	router.PathPrefix("/").Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Add security headers and correct MIME types
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if strings.HasSuffix(r.URL.Path, ".js") {
			w.Header().Set("Content-Type", "application/javascript")
		}

		// Log the request
		log.Printf("Request: %s %s", r.Method, r.URL.Path)

		// Serve static files
		http.FileServer(http.Dir("static")).ServeHTTP(w, r)
	}))
	// Start HTTPS server
	fmt.Println("Starting server on https://0.0.0.0:8443")
	log.Fatal(http.ListenAndServeTLS(":8443", "cert.crt", "cert.key", router))
}

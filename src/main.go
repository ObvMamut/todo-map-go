package main

import (
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
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
	completedData, err := ioutil.ReadFile("static/completed-data.json")
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

	if err := ioutil.WriteFile("static/completed-data.json", jsonData, 0644); err != nil {
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

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Be careful with this in production
	},
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Log client connection
	log.Printf("New WebSocket client connected from %s", conn.RemoteAddr())

	// Keep connection alive and handle messages
	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Error reading message: %v", err)
			return
		}

		// Log received message
		log.Printf("Received message from %s: %s", conn.RemoteAddr(), string(p))

		// Echo the message back (optional)
		if err := conn.WriteMessage(messageType, p); err != nil {
			log.Printf("Error writing message: %v", err)
			return
		}
	}
}

func main() {
	router := mux.NewRouter()

	// Existing routes
	router.HandleFunc("/save", saveTask).Methods("POST")
	router.HandleFunc("/delete", deleteTask).Methods("POST")
	router.HandleFunc("/tasks", getTasks).Methods("GET")
	router.HandleFunc("/complete", completeTask).Methods("POST")

	// Add WebSocket endpoint
	router.HandleFunc("/ws", handleWebSocket)

	// Service Worker route
	router.HandleFunc("/service-worker.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		w.Header().Set("Service-Worker-Allowed", "/")
		http.ServeFile(w, r, "static/service-worker.js")
	})

	// Static files handler
	router.PathPrefix("/").Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if strings.HasSuffix(r.URL.Path, ".js") {
			w.Header().Set("Content-Type", "application/javascript")
		}
		http.FileServer(http.Dir("static")).ServeHTTP(w, r)
	}))

	fmt.Println("Starting server on https://0.0.0.0:8080")
	log.Fatal(http.ListenAndServeTLS(":8080", "localhost.crt", "localhost.key", router))
}

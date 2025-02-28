import express from 'express';
import { createNewTask, getMyTasks, deleteTask, updateTask, editTask } from './TasksRouteController.js';

const TasksRoute = express.Router();

TasksRoute.get('/', getMyTasks);
TasksRoute.post('/create-task', createNewTask);
TasksRoute.delete('/delete-task', deleteTask);
TasksRoute.patch('/edit-task', editTask);
TasksRoute.patch('/update-task', updateTask);

export default TasksRoute;  
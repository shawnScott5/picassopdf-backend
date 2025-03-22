import config from '../config/config.js';
import TasksSchema from './TasksSchema.js';

const createNewTask = async(req, res, next) => {
    const form = req.body;
    const newTask = {
        createdDate: new Date().toLocaleString(),
        userId: form.userId,
        title: form.name.trim(),
        description: form.description,
        priority: form.priority,
        dueDate: form.dueDate,
        recurring: form.recurring === 'Yes' ? true : false,
        reminder: form.reminder,
        dueDateTime: form.time,
        flagged: form.flagged,
        status: form.status
    }
    const taskCreated = await TasksSchema.create(newTask);
    
    if(taskCreated) {
        return res.status(200).json({
            status: true,
            data: taskCreated,
            message: 'Task was created successfully!'
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const updateTask = async(req, res, next) => {
    const form = req.body;
    
    let updatedTask = await TasksSchema.findOneAndUpdate({ userId: form.userId, _id: form._id }, { $set: form }, { new: true });
    if (updatedTask) {
        return res.status(200).json({
            status: true,
            message: 'Task was updated successfully!'
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const editTask = async(req, res, next) => {
    const form = req.body;
    
    let updatedTask = await TasksSchema.findOneAndUpdate({ userId: form.userId, name: form.task.name }, { $set: { status: form.task.status }}, { new: true });

    if (updatedTask) {
        return res.status(200).json({
            status: true,
            message: 'Task was edited successfully!'
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const deleteTask = async(req, res, next) => {
     const form = req.query;
     const taskToDelete = {
        userId: form.userId,
        _id: form.taskId
     }
     const taskDeleted = await TasksSchema.findOneAndDelete(taskToDelete);
    
     if(taskDeleted) {
        return res.status(200).json({
            status: true,
            message: 'Task was deleted successfully!'
        });
     }
     return res.status(500).json({error: 'Something went wrong'});
}

const getMyTasks = async(req, res) => {
    const filter = req.query;
    const query = { $and: [{userId: filter.userId}] }; // Initialize $and operator as an array

    try {

        if(filter.reminder) {
            query.$and.push({ reminder: filter.reminder });
        }

        if(filter.priority) {
            query.$and.push({ priority: filter.priority });
        }

        if(filter.status) {
            query.$and.push({ status: filter.status });
        }

        if(filter.flagged) {
            query.$and.push({ flagged: filter.flagged });
        }

        const tasks = await TasksSchema.find(query)
            .sort({createdDate: -1})
            .skip((filter && filter.page) ? parseInt(filter.limit) * (parseInt(filter.page) - 1) : 0)
            .limit(parseInt(filter.limit));

        return res.status(200).json({
            status: true,
            data: tasks
        });
    } catch(error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

export { createNewTask, getMyTasks, deleteTask, updateTask, editTask };
import config from '../config/config.js';
import NotesSchema from './NotesSchema.js';

const createNewNote = async(req, res, next) => {
    const form = req.body;
    const newNote = {
        createdDate: new Date().toLocaleString(),
        userId: form.userId,
        title: form.noteTitle.trim(),
        description: form.editorContent
    }
    const noteCreated = await NotesSchema.create(newNote);
    
    if(noteCreated) {
        return res.status(200).json({
            status: true,
            message: 'Note was created successfully!',
            data: noteCreated
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const updateNote = async(req, res, next) => {
    const form = req.body;
    const updatedNote = await NotesSchema.findOneAndUpdate({ userId: form.userId, _id: form._id }, { $set: { title: form.noteTitle, description: form.editorContent }}, { new: true });
    console.log(updatedNote)
    if (updatedNote) {
        return res.status(200).json({
            status: true,
            message: 'Note was updated successfully!',
            data: updatedNote
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const deleteNote = async(req, res, next) => {
    const form = req.query;
    console.log(req.query)
    const noteToDelete = {
        userId: form.userId,
        _id: form.noteId
    }
    const noteDeleted = await NotesSchema.findOneAndDelete(noteToDelete);
    
    if(noteDeleted) {
        return res.status(200).json({
            status: true,
            message: 'Note was deleted successfully!'
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const getMyNotes = async(req, res, next) => {
    const form = req.query;
    try {
        const notes = await NotesSchema.find({userId: form.userId}).sort({createdDate: -1});

        return res.status(200).json({
            status: true,
            data: notes
        });
    } catch(error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

export { createNewNote, getMyNotes, deleteNote, updateNote };
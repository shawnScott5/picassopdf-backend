import config from '../config/config.js';
import ActionsSchema from './ActionsSchema.js';

const getMyNotes = async(req, res, next) => {

}

const createNewNote = async(req, res, next) => {
     const form = req.body;
     console.log(form)
        const newNote = {
            createdDate: new Date().toLocaleString(),
            userId: form.userId,
            title: form.noteTitle,
            description: form.editorContent
        }
        console.log(newNote)
        const noteCreated = await ActionsSchema.create(newNote);
        
        if(noteCreated) {
            return res.status(200).json({
                status: true,
                message: 'Note was created successfully!'
            });
        }
        return res.status(500).json({error: 'Something went wrong'});
}

const deleteNote = async(req, res, next) => {

}

const updateNote = async(req, res, next) => {

}

export { createNewNote, getMyNotes, deleteNote, updateNote };
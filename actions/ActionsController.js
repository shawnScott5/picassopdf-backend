import config from '../config/config.js';
import ActionsSchema from './ActionsSchema.js';
import UserSchema from '../users/UserSchema.js';
import nodemailer from 'nodemailer';

const mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'shawnscottjunior@gmail.com',
        pass: 'rcll vbee edce yprn'
    }
});

const getMyNotes = async(req, res, next) => {

}

const createNewNote = async(req, res, next) => {
     const form = req.body;

        const newNote = {
            createdDate: new Date().toLocaleString(),
            userId: form.userId,
            title: form.noteTitle,
            description: form.editorContent
        }
        
        const noteCreated = await ActionsSchema.create(newNote);
        
        if(noteCreated) {
            return res.status(200).json({
                status: true,
                message: 'Note was created successfully!'
            });
        }
        return res.status(500).json({error: 'Something went wrong'});
}

const featureSuggestion = async(req, res, next) => {
    try {
        const form = req.body;
        const subject = form.noteTitle || 'Report Bug';
        const message = form.editorContent;
        const user = await UserSchema.findOne({ _id: form.user });

        let mailDetails = {
            from: 'shawnscottjunior@gmail.com',
            to: 'support@distros.io',
            subject: subject,
            html: `
                <html>
                <head>
                    <title>Feature Suggestion</title>
                </head>
                <body>
                    <h1 style="color: black;">Feature Suggestion</h1>
                    <p style="color: black;">Dear Distros Support,</p>
                    <p style="color: black;">${message}</p>
                    <p style="color: black;">Thank you,</p>
                    <p style="color: black;">${user.name}</p>
                    <p style="color: black;">${user.email}</p>
                </body>
                </html>
            `,
        };

        // Wait for the email to be sent
        await mailTransporter.sendMail(mailDetails);

        // Send response **only once**
        res.status(200).json({ message: 'Mail sent successfully' });

    } catch (err) {
        console.error('Mail error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
}

const reportBug = async(req, res, next) => {
    try {
        const form = req.body;
        const subject = form.noteTitle || 'Report Bug';
        const message = form.editorContent;
        const user = await UserSchema.findOne({ _id: form.user });

        let mailDetails = {
            from: 'shawnscottjunior@gmail.com',
            to: 'support@distros.io',
            subject: subject,
            html: `
                <html>
                <head>
                    <title>Report Bug</title>
                </head>
                <body>
                    <h1 style="color: black;">Report Bug</h1>
                    <p style="color: black;">Dear Distros Support,</p>
                    <p style="color: black;">${message}</p>
                    <p style="color: black;">Thank you,</p>
                    <p style="color: black;">${user.name}</p>
                    <p style="color: black;">${user.email}</p>
                </body>
                </html>
            `,
        };

        // Wait for the email to be sent
        await mailTransporter.sendMail(mailDetails);

        // Send response **only once**
        res.status(200).json({ message: 'Mail sent successfully' });

    } catch (err) {
        console.error('Mail error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
}

const deleteNote = async(req, res, next) => {

}

const updateNote = async(req, res, next) => {

}

export { createNewNote, getMyNotes, deleteNote, updateNote, reportBug, featureSuggestion };
import express from 'express';
import { createNewList, getMyLists, deleteList, updateList } from './ListsRouteController.js';

const ListsRoute = express.Router();

ListsRoute.get('/', getMyLists);
ListsRoute.post('/create-list', createNewList);
ListsRoute.delete('/delete-list', deleteList);
ListsRoute.patch('/update-list', updateList);

export default ListsRoute;  
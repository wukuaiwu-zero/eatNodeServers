const deviceService = require('../services/device.service');
const personalNoteService = require('../services/personalNote.service');
const { getDeviceCredentials } = require('../utils/request');
const { paginateDataList } = require('../utils/pagination');

const NOTE_ID_MAX_LENGTH = 100;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getInput(req, key) {
  return req.body?.[key] ?? req.query?.[key] ?? req.params?.[key];
}

function validateText(value, fieldName, maxLength) {
  if (!value) {
    return `请填写${fieldName}`;
  }

  if (value.length > maxLength) {
    return `${fieldName}太长了，不能超过 ${maxLength} 个字符`;
  }

  return null;
}

function getNoteJson(req) {
  return req.body.noteJson
    || req.body.personalNoteJson
    || req.body.note
    || req.body;
}

async function upsertNote(req, res, next) {
  try {
    const noteJson = getNoteJson(req);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (noteJson === undefined || noteJson === null) {
      return res.status(400).json({ message: '请填写随手记数据' });
    }

    const note = await personalNoteService.upsertNoteByDevice(device.deviceId, noteJson);
    return res.json({ data: { note } });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: '随手记数据格式不正确' });
    }

    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function getNote(req, res, next) {
  try {
    const noteId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'noteId'));
    const noteIdError = validateText(noteId, '随手记 ID', NOTE_ID_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (noteIdError) {
      return res.status(400).json({ message: noteIdError });
    }

    const note = await personalNoteService.getNoteByDevice(device.deviceId, noteId);

    if (!note || note.deleted) {
      return res.status(404).json({ message: '随手记不存在' });
    }

    return res.json({ data: { note } });
  } catch (error) {
    return next(error);
  }
}

async function listNotes(req, res, next) {
  try {
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    const notes = await personalNoteService.listNotesByDevice(device.deviceId);

    return res.json({ data: paginateDataList(req, { notes }, 'notes') });
  } catch (error) {
    return next(error);
  }
}

async function deleteNote(req, res, next) {
  try {
    const noteId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'noteId'));
    const noteIdError = validateText(noteId, '随手记 ID', NOTE_ID_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (noteIdError) {
      return res.status(400).json({ message: noteIdError });
    }

    const data = await personalNoteService.deleteNoteByDevice(device.deviceId, noteId);
    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  upsertNote,
  getNote,
  listNotes,
  deleteNote
};

const { query } = require('../config/db');
const { env } = require('../config/env');

const TABLE_NAME = 'personal_notes';

const mockNotes = new Map();

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createNoteId() {
  return `note_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function getMockKey(userId, noteId) {
  return `${userId}:${noteId}`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTimeValue(value) {
  function formatBeijingTime(date) {
    const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return `${beijingTime.toISOString().slice(0, -1)}+08:00`;
  }

  if (value instanceof Date) {
    return formatBeijingTime(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatBeijingTime(new Date(value));
  }

  if (typeof value === 'string') {
    const text = value.trim();
    const numeric = Number(text);

    if (Number.isFinite(numeric) && text) {
      return formatBeijingTime(new Date(numeric));
    }

    const parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) {
      return formatBeijingTime(new Date(parsed));
    }
  }

  return null;
}

function normalizeNote(noteJson) {
  if (noteJson === undefined || noteJson === null) {
    throw new TypeError('请填写随手记数据');
  }

  const note = typeof noteJson === 'string' ? JSON.parse(noteJson) : { ...noteJson };

  if (!note || typeof note !== 'object' || Array.isArray(note)) {
    throw new TypeError('随手记数据格式不正确');
  }

  const noteId = normalizeText(note.id || note._id || note.noteId) || createNoteId();
  const content = normalizeText(note.content || note.text || note.title);
  const createTime = Number(note.create_time || note.createTime || note.timestamp || Date.now());

  if (!noteId) {
    throw new TypeError('随手记 id 不能为空');
  }

  if (!content) {
    throw new TypeError('随手记内容不能为空');
  }

  return {
    noteId,
    content,
    createTime: Number.isFinite(createTime) ? createTime : Date.now()
  };
}

function toNote(row) {
  if (!row) {
    return null;
  }

  const createTime = normalizeTimeValue(row.create_time);

  return {
    id: row.note_id,
    _id: row.note_id,
    noteId: row.note_id,
    userId: row.user_id,
    user_id: row.user_id,
    content: row.content,
    create_time: createTime,
    createTime,
    timestamp: createTime,
    version: row.version,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function upsertNote(userId, noteJson) {
  const normalized = normalizeNote(noteJson);

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const key = getMockKey(userId, normalized.noteId);
    const current = mockNotes.get(key);
    const row = {
      id: current?.id || mockNotes.size + 1,
      note_id: normalized.noteId,
      user_id: userId,
      content: normalized.content,
      create_time: normalized.createTime,
      version: (current?.version || 0) + 1,
      deleted_at: null,
      created_at: current?.created_at || now,
      updated_at: now
    };

    mockNotes.set(key, row);
    return toNote(row);
  }

  await query(
    `INSERT INTO ${TABLE_NAME}
       (note_id, user_id, content, create_time, version)
     VALUES (?, ?, ?, FROM_UNIXTIME(? / 1000), 1)
     ON DUPLICATE KEY UPDATE
       content = VALUES(content),
       create_time = VALUES(create_time),
       version = version + 1,
       deleted_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [
      normalized.noteId,
      userId,
      normalized.content,
      normalized.createTime
    ]
  );

  return getNoteByUser(userId, normalized.noteId);
}

async function getNoteByUser(userId, noteId) {
  if (env.useMockDb) {
    return toNote(mockNotes.get(getMockKey(userId, noteId)));
  }

  const rows = await query(
    `SELECT id, note_id, user_id, content, create_time, version, deleted_at, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE user_id = ? AND note_id = ?`,
    [userId, noteId]
  );

  return toNote(rows[0]);
}

async function listNotesByUser(userId, options = {}) {
  const includeDeleted = Boolean(options.includeDeleted);

  if (env.useMockDb) {
    return Array.from(mockNotes.values())
      .filter((row) => row.user_id === userId)
      .filter((row) => includeDeleted || !row.deleted_at)
      .sort((a, b) => {
        if ((a.create_time || 0) === (b.create_time || 0)) {
          return a.id - b.id;
        }
        return (b.create_time || 0) - (a.create_time || 0);
      })
      .map(toNote);
  }

  const filters = ['user_id = ?'];
  const params = [userId];

  if (!includeDeleted) {
    filters.push('deleted_at IS NULL');
  }

  const rows = await query(
    `SELECT id, note_id, user_id, content, create_time, version, deleted_at, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE ${filters.join(' AND ')}
     ORDER BY create_time DESC, id DESC`,
    params
  );

  return rows.map(toNote);
}

async function deleteNoteByUser(userId, noteId) {
  const note = await getNoteByUser(userId, noteId);

  if (!note || note.deleted) {
    return null;
  }

  if (env.useMockDb) {
    const key = getMockKey(userId, noteId);
    const current = mockNotes.get(key);
    current.deleted_at = new Date().toISOString();
    current.version += 1;
    current.updated_at = current.deleted_at;
    mockNotes.set(key, current);
    return toNote(current);
  }

  await query(
    `UPDATE ${TABLE_NAME}
     SET deleted_at = CURRENT_TIMESTAMP,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND note_id = ? AND deleted_at IS NULL`,
    [userId, noteId]
  );

  return getNoteByUser(userId, noteId);
}

async function deleteNoteByDevice(deviceId, noteId) {
  const note = await deleteNoteByUser(deviceId, noteId);

  if (!note) {
    throw createNotFoundError('随手记不存在');
  }

  return { note };
}

module.exports = {
  upsertNoteByDevice: upsertNote,
  getNoteByDevice: getNoteByUser,
  listNotesByDevice: listNotesByUser,
  deleteNoteByDevice
};

-- One room snapshot is one atomic write. Triggers keep cross-room membership
-- locks in the same transaction, including CAS updates and room deletion.
CREATE TABLE bingo_rooms (
  code TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(json_valid(state)),
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('waiting', 'playing', 'finished')),
  ended_at INTEGER
);
CREATE INDEX idx_bingo_expiry ON bingo_rooms(ended_at) WHERE status = 'finished';

CREATE TABLE bingo_active_members (
  user_id INTEGER PRIMARY KEY,
  room_code TEXT NOT NULL
);
CREATE INDEX idx_bingo_active_room ON bingo_active_members(room_code);

CREATE TRIGGER bingo_room_insert AFTER INSERT ON bingo_rooms BEGIN
  INSERT INTO bingo_active_members(user_id, room_code)
  SELECT json_extract(value, '$.id'), NEW.code
  FROM json_each(NEW.state, '$.players')
  WHERE NEW.status IN ('waiting', 'playing') AND json_extract(value, '$.active') = 1;
END;

CREATE TRIGGER bingo_room_update AFTER UPDATE ON bingo_rooms BEGIN
  DELETE FROM bingo_active_members WHERE room_code = OLD.code;
  INSERT INTO bingo_active_members(user_id, room_code)
  SELECT json_extract(value, '$.id'), NEW.code
  FROM json_each(NEW.state, '$.players')
  WHERE NEW.status IN ('waiting', 'playing') AND json_extract(value, '$.active') = 1;
END;

CREATE TRIGGER bingo_room_delete AFTER DELETE ON bingo_rooms BEGIN
  DELETE FROM bingo_active_members WHERE room_code = OLD.code;
END;

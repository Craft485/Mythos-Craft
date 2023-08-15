CREATE DATABASE mythoscraft IF NOT EXISTS;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT NOT NULL,
    username VARCHAR(255) DEFAULT '' NOT NULL,
    password VARCHAR(255) DEFAULT '' NOT NULL,
    -- JSON list, entries vary
    preferences TEXT DEFAULT NULL,
    exp BIGINT(255) DEFAULT 0 NOT NULL,
    level BIGINT(255) DEFAULT 0 NOT NULL,
    gamesWon BIGINT(255) DEFAULT 0 NOT NULL,
    gamesPlayed BIGINT(255) DEFAULT 0 NOT NULL,
    CONSTRAINT PK_Users PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS inventory (
    id BIGINT AUTO_INCREMENT NOT NULL,
    -- JSON list with name -> count relation
    cards TEXT DEFAULT NULL,
    -- Currency
    orichalcum BIGINT DEFAULT 0 NOT NULL,
    CONSTRAINT FK_Inventory FOREIGN KEY (id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS decks (
    deckID BIGINT DEFAULT 0 NOT NULL,
    userID BIGINT NOT NULL,
    name VARCHAR(255) DEFAULT '' NOT NULL,
    -- JSON list with name -> count relation
    cards TEXT DEFAULT '' NOT NULL
);

-- Reset DB
TRUNCATE inventory;
TRUNCATE decks;
DELETE FROM users;
ALTER TABLE users AUTO_INCREMENT = 0;
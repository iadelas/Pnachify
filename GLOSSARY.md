# Pnachify

A browser tool that turns copied PS2 cheat codes into PNACH files for PS2 emulators, built for people playing on an Android phone. The language below is the vocabulary used across the app, its docs and the ported converter core.

## Cheat codes

**Cheat code**:
A pair of hexadecimal values — a memory address and the value to write there — that changes a running game.
_Avoid_: hack, patch, code line

**Code list**:
The set of cheat codes a user copies as text, usually with code names and section headers.
_Avoid_: cheat file, list of hacks

**Code format**:
The written shape of a code list. Two lists with the same codes but different code formats do not convert the same way.
_Avoid_: input type, syntax

**RAW code**:
A cheat code in its unencrypted, device-neutral form.
_Avoid_: plain code, decrypted code

**RAW variant**:
One of several unencrypted code formats that differ only in address offset or in the quirks of the device they came from (for example CRAW, GRAW, ARAW).
_Avoid_: RAW subtype, raw flavour

**Encrypted code**:
A cheat code after a cheat device has scrambled it with that device's cipher.
_Avoid_: locked code, ciphered code

## Cheat devices

**Cheat device**:
Hardware or software that stores cheat codes in its own encrypted format: CodeBreaker, Action Replay, GameShark / Xploder, ARMAX.
_Avoid_: cheat cartridge, device type

**Crypt**:
The cipher a cheat device applies to its code list. Each supported cheat device has one, and some devices have several versions.
_Avoid_: encryption, encoding, cipher type

**Transpose**:
Rewrite a code list from one cheat device's meaning to another's, so that code types such as pointers still behave the same.
_Avoid_: convert, translate

## PNACH and emulators

**PNACH**:
A plain-text cheat file read by PCSX2 and its Android forks (NetherSX2, AetherSX2).
_Avoid_: patch file, cheat file

**CRC**:
The eight-hex-digit checksum that identifies one specific build of a game disc. Emulators load a cheat file when its filename matches the running game's CRC.
_Avoid_: game id, disc id, serial

**Cheats folder**:
The emulator folder holding one PNACH file per game.
_Avoid_: cheat directory, pnach directory

**gametitle**:
The PNACH header line carrying the game's display name.
_Avoid_: title line, header name

**Section**:
A named group of codes inside a PNACH file, shown to the user as one entry in the emulator's cheat list.
_Avoid_: block, group header

## The app

**Conversion**:
One run of the app: an input code list becomes a PNACH file.
_Avoid_: transform, processing

**Auto-detect**:
The app's guess at which code format a pasted code list uses, confirmed by checking whether the decrypted result looks like valid codes.
_Avoid_: sniffing, format detection, guessing

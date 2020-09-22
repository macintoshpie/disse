const EventEmitter = require('events').EventEmitter
const em = new EventEmitter()

const express = require('express')
const app = express()

const noError = (err) => { if (err) { throw err } }
const rollDie = () => {
    const min = 1
    const max = 6
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
const insertRoll = ({ value, name, callback }) => {
    db.run(`INSERT INTO rolls (value, name) VALUES(?, ?)`, [value, name], function (err) {
        noError(err)
        if (callback !== undefined) {
            callback(this.lastID)
        }
    })
}

const getRolls = ({ afterID, callback }) => {
    let sql = 'SELECT value, name, rowid FROM rolls ';
    if (afterID !== undefined) {
        sql += `WHERE rowid > ${afterID}`
    }

    db.all(sql, [], (err, rows) => {
        noError(err)
        callback(rows)
    });
}

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
    db.run('CREATE TABLE rolls(value INTEGER, name TEXT)', noError)
    insertRoll({ value: rollDie(), name: 'User A' })
    insertRoll({ value: rollDie(), name: 'User B' })
    insertRoll({ value: rollDie(), name: 'User C' })
})

const ROLL_EVENT = 'roll'
const  writeSseEvent = (res, payload, id, event) => {
    if (id != undefined) {
        res.write(`id: ${escape(id)}\n`)
    }
    if (event != undefined) {
        res.write(`event: ${escape(event)}\n`)
    }
    res.write(`data: ${escape(payload)}\n\n`)
}

app.get('/rolls', (req, res) => {
    getRolls({
        afterID: req.query.after,
        callback: (rows) => res.json({rolls: rows})
    })
})

app.post('/rolls', (req, res) => {
    const value = rollDie()
    const name = req.query.name
    console.log(`${name} rolled ${value}`)
    insertRoll({
        value,
        name,
        callback: (rowid) => {
            res.status(201)
            res.send()
            em.emit(ROLL_EVENT, { value, name, rowid })
        }
    })
})

app.get('/events', async (req, res) => {
    const lastEventID = req.header('Last-Event-ID')
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-control', 'no-cache')
    res.setHeader('Transfer-Encoding', 'chunked')
    res.flushHeaders()

    // send any missed rolls using the last event id (which is rowid)
    if (lastEventID != undefined) {
        getRolls({
            afterID: lastEventID,
            callback: (rows) => rows.forEach(row => writeSseEvent(res, JSON.stringify(row), row.rowid, ROLL_EVENT))
        })
    }

    // listen for new rolls and send them as SSEs
    const rollListener = (roll) => {
        writeSseEvent(res, JSON.stringify(roll), roll.rowid, ROLL_EVENT)
    }
    res.addListener('close', () => em.removeListener(ROLL_EVENT, rollListener))
    em.addListener(ROLL_EVENT, rollListener)

    // simulate sporadic client disconnects by ending the open connection after some time
    // this demonstrates the ability of browser client auto reconnecting and sending last id
    // await new Promise(resolve => setTimeout(resolve, 5000))
    // em.removeListener(ROLL_EVENT, rollListener)
    // res.end()
})

app.use(express.static('static'))

app.listen(3000)

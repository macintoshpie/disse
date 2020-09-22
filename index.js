const express = require('express')
const app = express()

const noError = (err) => { if (err) { throw err } }
const rollDie = () => {
    const min = 1
    const max = 6
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
const insertRoll = ({ value, name, callback }) => {
    db.run(`INSERT INTO rolls (value, name) VALUES(?, ?)`, [value, name], (err) => {
        noError(err)
        if (callback !== undefined) {
            callback(this.lastID)
        }
    })
}

const getRolls = ({ afterID, callback }) => {
    let sql = 'SELECT * FROM rolls';
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

app.get('/rolls', (req, res) => {
    getRolls({
        afterID: req.query.after,
        callback: (rows) => res.json({rolls: rows})
    })
})

app.post('/rolls', (req, res) => {
    const value = rollDie()
    console.log(`${req.query.name} rolled ${value}`)
    insertRoll({
        value,
        name: req.query.name,
        callback: () => {
            res.status(201)
            res.send()
        }
    })
})

app.use(express.static('static'))

app.listen(3000)

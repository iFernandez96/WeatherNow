import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';

const app = express();

app.set('view engine', 'ejs')
app.use(express.static('public'))
// Express needs the following line to parse data sent using the post method.
app.use(express.urlencoded({extended:true}));

// Express Session specific
app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
}))

const pool = mysql.createPool({
    host: "israeljosefernandez.tech",
    user: "israeljo_laptop",
    password: "Cst-336",
    database: "israeljo_database_1",
    connectionLimit: 10,
    waitForConnections: true
});

const conn = await pool.getConnection();

function isAuthenticated(req, res, next) {
    if (req.session.authenticated == true) {
        next();
    } else {
        res.redirect('/');
    }
}

//routes
app.get('/', async (req, res) => {
    let auth = req.session.authenticated
   res.render('home.ejs', {auth});
});

app.get('/logout',isAuthenticated, (req, res) => {
    req.session.destroy();
    res.render('logout');
})

app.get("/dbTest", async(req, res) => {
    let sql = "SELECT CURDATE()";
    const [rows] = await conn.query(sql);
    res.send(rows);
});//dbTest

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/profile', isAuthenticated, (req, res) => {
    let auth = req.session.authenticated;
    res.render('profile', {auth});
});

app.post('/login', async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    let sql = `SELECT * FROM admin WHERE username = ?`
    let sqlParams = [username];
    const [rows] = await conn.query(sql, sqlParams);
    if (rows.length <= 0) {
        res.redirect('/');
        return;
    } 
    let passwordHash = rows[0].password;
    let match = await bcrypt.compare(password, passwordHash);
    if (match) {
        req.session.fullName = rows[0].firstName + " " + rows[0].lastName;
        req.session.authenticated = true;
        res.render('profile');
    } else {
        res.redirect('/');
    }

});

app.get('/', (req, res) => {
    let auth = req.session.authenticated;
    res.render('home', {auth});
});

app.listen(3001, ()=>{
    console.log("Express server running")
})
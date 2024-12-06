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

app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
});

const pool = mysql.createPool({
    host: "israeljosefernandez.tech",
    user: "israeljo_laptop",
    password: "Cst-336",
    database: "israeljo_database_2",
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

function isNotAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        return res.redirect('/profile');
    }
    next();
}

//routes
app.get('/', async (req, res) => {
    let auth = req.session.authenticated
    res.render('home.ejs', {auth});
});

app.get('/logout',isAuthenticated, (req, res) => {
    req.session.destroy();
    let auth = false;
    res.render('home', {auth});
})

app.get("/dbTest", async(req, res) => {
    let sql = "SELECT CURDATE()";
    const [rows] = await conn.query(sql);
    res.send(rows);
});//dbTest

app.get('/profile', isAuthenticated, (req, res) => {
    let auth = req.session.authenticated;
    res.render('profile', {auth});
});

app.post('/login',isNotAuthenticated, async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    let sql = `SELECT * FROM user WHERE username = ?`;
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
        let auth = req.session.authenticated;
        res.redirect('profile', {auth});
    } else {
        res.redirect('/');
    }

});
app.get('/register', isNotAuthenticated, (req, res) => {
    let auth = req.session.authenticated;
    let error = '';
    res.render('register', {auth, error});
});
app.post('/register', async (req, res) => {
    // const { username, email, password, confirmPassword } = req.body;
    let username = req.body.username;
    let email = req.body.email;
    let password = req.body.password;
    let confirmPassword = req.body.confirmPassword;
    let auth = req.session.authenticated;

    if (password !== confirmPassword) {
        let error = "Passwords do not match";
        res.render('register', {auth, error});
        return
    }

    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // INSERT user into database here
    // Example pseudo-code:
    let sql = `INSERT INTO user (username, email, password) VALUES (?, ?, ?)`
    let sqlParams = [username, email, hashedPassword]
    
    await conn.query(sql, sqlParams);
    res.redirect('/login', {auth});
});

app.get('/login',isNotAuthenticated, async (req, res) => {
    let auth = req.session.authenticated;
    res.render('login', {auth});
})
app.get('/', (req, res) => {
    let auth = req.session.authenticated;
    res.render('home', {auth});
});

app.listen(3001, ()=>{
    console.log("Express server running")
})
 //James Fisher
import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const weatherKey = process.env.WEATHER_KEY;
var weatherBaseUrl = 'https://api.tomorrow.io/v4/weather/forecast';

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
    res.locals.auth = req.session.authenticated;
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

function isAuthenticatedAdmin(req, res, next) {
    if (req.session.authenticated == true && req.session.admin == true) {
        next();
    } else {
        res.redirect('/');
    }
}

function isNotAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        let username = req.session.username;
        let email = req.session.email;
        return res.redirect('/profile', {username, email});
    }
    next();
}

function assembleUrl(zip, units) {
    const params = new URLSearchParams({
        location: zip + " US",
        timesteps: "1d",
        units: units,
        apikey: weatherKey
    });

    return `${weatherBaseUrl}?${params.toString()}`;
}

async function getWeather(zip, units) {
    console.log(assembleUrl(zip));
    let response = await fetch(assembleUrl(zip, units));
    let data = await response.json();
    return data;
}

//routes
app.get('/', async (req, res) => {
    let weather;
    if (req.session.authenticated) {
        let userId = req.session.userId;
        let sql = `SELECT * FROM userPreferences WHERE user_id = ?`;
        let sqlParams = [userId];
        const [rows] = await conn.query(sql, sqlParams);
        var units = rows[0].user_temp;
        weather = await getWeather(rows[0].zipcode, units);
    } else {
        weather = await getWeather(95060, "imperial")
    }
    let location = weather.location.name;
    console.log(weather.timelines.daily);
    res.render('home.ejs', {weather, location});
});

 app.get('/location', async (req, res) => {
     let weather;
     if (req.session.authenticated) {
         let userId = req.session.userId;
         let sql = `SELECT * FROM userPreferences WHERE user_id = ?`;
         let sqlParams = [userId];
         const [rows] = await conn.query(sql, sqlParams);
         var units = rows[0].user_temp;
         weather = await getWeather(rows[0].zipcode, units);
     } else {
         weather = await getWeather(95060, "imperial")
     }
     let location  = req.query.location;
     console.log(location);
     console.log(weather.timelines.daily);
     res.render('location.ejs', {weather, location});
 });

 app.get('/search', async (req, res) => {
     let zipcode  = req.query.zipcode;
     let weather = await getWeather(zipcode);
     console.log(weather.timelines.daily);
     let location = weather.location.name;
     res.render('search.ejs', {weather, location});
 });

app.get('/logout',isAuthenticated, (req, res) => {
    req.session.destroy();
    res.redirect('/');
})

app.get("/dbTest", async(req, res) => {
    let sql = "SELECT CURDATE()";
    const [rows] = await conn.query(sql);
    res.send(rows);
});//dbTest

app.get('/admin', isAuthenticatedAdmin, async (req, res) => {
    let sql = `SELECT * FROM user`;
    const [users] = await conn.query(sql);
    res.render('admin', {users});
});

app.post('/admin/users/:id/edit', isAuthenticatedAdmin, async (req, res) => {
    const userId = req.params.id;
    const { username, email, is_admin } = req.body;

    const sql = `UPDATE user SET username = ?, email = ?, is_admin = ? WHERE user_id = ?`;
    const sqlParams = [username, email, is_admin, userId];

    await pool.query(sql, sqlParams);
    res.redirect('/admin');
});

app.post('/admin/users/:id/delete', isAuthenticatedAdmin, async (req, res) => {
    const userId = req.params.user_id;

    const sql = `DELETE FROM user WHERE id = ?`;
    const sqlParams = [userId];

    await pool.query(sql, sqlParams);
    res.redirect('/admin');
});

app.get('/profile', isAuthenticated, async (req, res) => {
    let username = req.session.username;
    let email = req.session.email;

    if (req.session.admin) {
        res.redirect('/admin');
        return;
    }

    const [userPreferences] = await pool.query(
        'SELECT user_temp, zipcode, image FROM userPreferences WHERE user_id = ?',
        [req.session.userId]
    );

    res.render('profile', {
        username,
        email,
        tempUnit: userPreferences?.user_temp || 'metric',
        zipcode: userPreferences?.zipcode || '',
        image: userPreferences?.image || 'default.jpg',
    });
});

app.post('/profile', isAuthenticated, async (req, res) => {
    const { email, tempUnit, savedLocation, backgroundImage } = req.body;
    const userId = req.session.userId;
        await pool.query(
            'UPDATE user SET email = ? WHERE user_id = ?',
            [email, userId]
        );

        const [existingPreference] = await pool.query(
            'SELECT * FROM userPreferences WHERE user_id = ?',
            [userId]
        );

        if (existingPreference.length > 0) {
            await pool.query(
                'UPDATE userPreferences SET user_temp = ?, zipcode = ?, image = ? WHERE user_id = ?',
                [tempUnit, savedLocation, backgroundImage, userId]
            );
        } else {
            await pool.query(
                'INSERT INTO userPreferences (user_id, user_temp, zipcode, image) VALUES (?, ?, ?, ?)',
                [userId, tempUnit, savedLocation, backgroundImage]
            );
        }
        res.redirect('/profile');

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
        req.session.username = rows[0].username;
        req.session.email = rows[0].email;
        req.session.authenticated = true;
        req.session.admin = rows[0].is_admin;
        req.session.userId = rows[0].user_id;
        res.redirect('/profile');
    } else {
        res.redirect('/');
    }

});
app.get('/register', isNotAuthenticated, (req, res) => {
    let error = '';
    res.render('register', {error});
});
app.post('/register', async (req, res) => {
    // const { username, email, password, confirmPassword } = req.body;
    let username = req.body.username;
    let email = req.body.email;
    let password = req.body.password;
    let confirmPassword = req.body.confirmPassword;

    if (password !== confirmPassword) {
        let error = "Passwords do not match";
        res.render('register', {error});
        return
    }

    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // INSERT user into database here
    // Example pseudo-code:
    let sql = `INSERT INTO user (username, email, password) VALUES (?, ?, ?)`
    let sqlParams = [username, email, hashedPassword]

    await conn.query(sql, sqlParams);
    res.redirect('/login');
});

app.get('/login',isNotAuthenticated, async (req, res) => {
    res.render('login');
})
app.get('/home', (req, res) => {
    res.render('home');
});

app.listen(3001, ()=>{
    console.log("Express server running")
})
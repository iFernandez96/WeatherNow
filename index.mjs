//James Fisher
import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const weatherKey = process.env.WEATHER_KEY;
let weatherBaseUrl = 'https://api.tomorrow.io/v4/weather/forecast';

app.set('view engine', 'ejs')
app.use(express.static('public'))

// Express needs the following line to parse data sent using the post method.
app.use(express.urlencoded({extended:true}));

app.use('/node_modules', express.static('node_modules'));
// Express Session specific
app.set('trust proxy', 1) // trust first proxy
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
}))

app.use(async (req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.auth = req.session.authenticated;
    res.locals.locations = await getLocations();
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
    if (req.session.authenticated === true) {
        next();
    } else {
        res.redirect('/');
    }
}

function isAuthenticatedAdmin(req, res, next) {
    if (req.session.authenticated === true && req.session.admin === true) {
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

async function getLocations() {
    let sql = `SELECT * FROM saved_locations`;
    const [rows] = await conn.query(sql);
    console.log(rows);
    return rows;
}

async function getWeather(zip, units) {
    let response = await fetch(assembleUrl(zip, units));
    return await response.json();
}

//routes
app.get('/', async (req, res) => {
    let weather;
    let units = "imperial";
    if (req.session.authenticated) {
        let userId = req.session.userId;
        let sql = `SELECT * FROM userPreferences WHERE user_id = ?`;
        let sqlParams = [userId];
        const [rows] = await conn.query(sql, sqlParams);
        units = rows[0].user_temp;
        weather = await getWeather(rows[0].zipcode, units);
    } else {
        weather = await getWeather(95060, "imperial")
    }
    let location = weather.location.name;
    res.render('home.ejs', {weather, location, units});
});

 app.get('/location', async (req, res) => {
     let weather;
     let units = "imperial";
     if (req.session.authenticated) {
         let userId = req.session.userId;
         let sql = `SELECT * FROM userPreferences WHERE user_id = ?`;
         let sqlParams = [userId];
         const [rows] = await conn.query(sql, sqlParams);
         units = rows[0].user_temp;
         weather = await getWeather(req.query.location, units);
     } else {
         weather = await getWeather(req.query.location, "imperial")
     }
     let sql = `SELECT * FROM saved_locations WHERE zipcode = ?`;
     let sqlParams = [req.query.location];
     let [data] = await conn.query(sql, sqlParams);
     let location = data[0].location_name;
     res.render('location.ejs', {weather, location, units});
 });

 app.get('/search', async (req, res) => {
     let weather;
     let units = "imperial";
     let zipcode  = req.query.zipcode;
     if (req.session.authenticated) {
         let userId = req.session.userId;
         let sql = `SELECT * FROM userPreferences WHERE user_id = ?`;
         let sqlParams = [userId];
         const [rows] = await conn.query(sql, sqlParams);
         units = rows[0].user_temp;
         weather = await getWeather(zipcode, units);
     } else {
         weather = await getWeather(zipcode, "imperial")
     }
     let location = weather.location.name;
     res.render('search.ejs', {weather, location, units});
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
    let image = req.session.image;
    let zipCode = req.session.zipCode;
    let tempUnit = req.session.userTemp;
    
    
    if (req.session.admin) {
        res.redirect('/admin');
        return;
    }
    res.render('profile', {
        username,
        email,
        tempUnit,
        zipCode,
        image,
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
        req.session.email = email;
        req.session.userTemp = tempUnit;
        req.session.zipCode = savedLocation;
        req.session.image = backgroundImage;
        res.redirect('/profile');

});

app.post('/login',isNotAuthenticated, async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    let sql = `
        SELECT user.*, userPreferences.user_temp, userPreferences.image, userPreferences.zipcode
        FROM user
        LEFT JOIN userPreferences ON user.user_id = userPreferences.user_id
        WHERE user.username = ?
    `;
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
        req.session.userTemp = rows[0].user_temp;
        req.session.image = rows[0].image;
        req.session.zipCode = rows[0].zipcode;
        res.redirect('/profile');
    } else {
        res.redirect('/login');
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
    // await conn.query(sql, sqlParams);
    let [result] = await conn.query(sql, sqlParams);
    let sql_userid = `SELECT user_id FROM user WHERE username = ?`
    // await conn.query(sql_userid, [username]);
    let [userid] = await conn.query(sql_userid, [username]);
    // console.log(userid[0].user_id);
    let sql2 = `INSERT INTO userPreferences (user_id, zipcode, user_temp, image) VALUES (?, ?, ?, ?)`
    let sqlParams2 = [userid[0].user_id, 93955, 'imperial', 'default']
    await conn.query(sql2, sqlParams2);

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
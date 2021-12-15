const express = require('express');
const jsonwebtoken = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();

//-- Need CORS if JavaScript (client side) needs to make an HTTP request
//-- to an HTTP server with a different origin (scheme, hostname and/or PORT).
//-- (Ex: localhost:4200 and localhost:3000)
app.use(cors());

require('dotenv').config();
const port = process.env.PORT;
const JWT_KEY = process.env.JWT_KEY;

//-- Middleware
app.use(express.json());

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log('authHeader: ', authHeader);

    if (authHeader) {
        //-- Get the token from the Authorization header (with the "Bearer" removed)
        const token = authHeader.split(' ')[1];
        if (token === 'null') {
          return res.status(401).send('Unauthorized user');
        }
        console.log("Verifying token");
        jsonwebtoken.verify(token, JWT_KEY, (error, user) => {
            if (error) {
              return res.sendStatus(403).send('Token error');
            }
            req.user = user;
            console.log("Token verified");
            next();
        });
    } else {
      res.sendStatus(401).send('Unauthorized request');
    }
};


//-- Connect to the database
app.use(async (req, res, next) => {
    global.db = await mysql.createConnection({ 
      connectionLimit: 10,
      host: process.env.DB_HOST, 
      user: process.env.DB_USER, 
      password: process.env.DB_PASSWORD, 
      database: process.env.DB_NAME, 
    });

    global.db.query(`SET time_zone = '-8:00'`);
    await next();
    // global.db.release();
    // global.db.destroy();
    global.db.end();
});

//-- LOGIN
app.post('/login', async (req, res) => {
    console.log("LOGGING IN");
    const { email, password } = req.body;
    console.log(email, password);

    // try {
        //-- Filter user from the users array by username and password
        const [[user]] = await global.db.query(
                                      'SELECT * FROM Users WHERE email=?',
                                      [email]
        );
        console.log('user: ', user);
    // } catch (err) {
    //     console.log('ERROR');
    //     console.log(err);
    // }

    if (user) {
      console.log("Got user info: ", user);
      bcrypt.compare(password, user.password, function(err, compareResult) {
        console.log('compareResult: ', compareResult);
        if (compareResult == true) {
          console.log("Password matched");
          //-- Generate an access token
          console.log('idUser: ', user.idUser);
          console.log('email: ', user.email);
          const token = jsonwebtoken.sign({ idUser: user.idUser, email: user.email },
                                          JWT_KEY);
            console.log('token: ', token);
            console.log({token});
            // res.json({ jwt: token });
            res.json({ token });
        }
        else {
          res.send('Password incorrect');
        }
      });
    } 
    else {
      res.send('User not found');
    }
});

//-- REGISTER
app.post('/register', async function(req, res) {
    // Generate salt
    bcrypt.genSalt(12, (err, salt) => {
      // Hash password
      bcrypt.hash(req.body.password, salt, async (err, hash) => {
          console.log('Salt: ', salt);
          console.log('Hash: ', hash); 
          try {
              const { fName, lName, email, deletedFlag } = req.body;
              const [user] = await global.db.query(
                                              `INSERT INTO Users(fName, lName, email, password, deletedFlag)
                                                    VALUES(?, ?, ?, ?, ?)`,
                                              [
                                                fName,
                                                lName,
                                                email,
                                                hash ,
                                                deletedFlag 
                                              ]
              );
              console.log(user.insertId);
              //-- Generate token (string)
              const token = jsonwebtoken.sign({idUser: user.insertId, email: req.body.email}, JWT_KEY);
              res.json(token);
          } catch (error) {
            console.log(error);
            console.log('Error adding user to the database!');
          }
      });
    });
});

//-- GET Projects
app.get('/project', authenticateJWT, async (req, res) => {
  // const user = req.user;
  // const { idProject } = req.body;
  const [data] = await global.db.query(`SELECT idProject, projectName FROM Project
                                            WHERE deletedFlag=0
                                            ORDER BY idProject DESC`);
  res.json({ message: "GET project - success!",
             data });
});

//-- ADD a Project
app.post('/project', authenticateJWT, async function(req, res) {
  const user = req.user;
  console.log("User: ", user);
  console.log("req.body: ", req.body);
  console.log("req.body.projectName: ", req.body);
  const { projectName } = req.body;
  console.log('projectName: ', projectName);
  const [data] = await global.db.query(`INSERT INTO Project(
                                                            projectName, 
                                                            projectDate, 
                                                            idUser, 
                                                            deletedFlag
                                                           )
                                              VALUES(?, NOW(), ?, 0)`,
                                        [projectName, user.idUser]
                                      );
  console.log('Backend - project data added', projectName);
  res.json({ message: "Success! Project has been added!",
  data });
});

//-- UPDATE project name
app.put('/project', authenticateJWT, async function(req, res) {
  const user = req.user;
  const { idProject, projectName } = req.body;
  const [data] = await global.db.query(`UPDATE Project SET projectName=?, 
                                                           projectDate=NOW()
                                                WHERE idUser=? AND idProject=? AND deletedFlag=0`,
                                        [ 
                                          projectName, 
                                          user.idUser, 
                                          idProject
                                        ]
  );
  res.json({ message: "Success! Project has been renamed.",
             data });
});

//-- "DELETE" Project - assert deletedFlag
app.delete('/project', authenticateJWT, async function(req, res) {
  const user = req.user;
  const { idProject } = req.body;
  console.log('DELETE req.body: ', req.body);
  const [data] = await global.db.query(`UPDATE Project SET projectDate=NOW(),
                                                           deletedFlag=1
                                                       WHERE idUser=? AND idProject=?`,
                                        [ 
                                          user.idUser, 
                                          idProject
                                        ]
  );
  res.json({ message: "Success! Project has been deleted.",
             data });
});
// //-- DELETE Project - Irreversible
// app.delete('/project', authenticateJWT, async (req, res) => {
//   const user = req.user;
//   const { idProject } = req.body;
//   // console.log('idUser: ', user);
//   const [data] = await global.db.query(`DELETE FROM Project WHERE idUser=? AND idProject=?`,
//                                         [user.idUser, idProject]);
//   res.json({ message: "Success! Project deleted",
//              data });
// });


app.get('/bug', authenticateJWT, async (req, res) => {
  // const user = req.user;
  // const { idBug } = req.body;
  const [data] = await global.db.query(`SELECT  prj.projectName,
                                                bg.idProject,
                                                bg.idBug, 
                                                bg.idUser, 
                                                bg.bugTitle,
                                                bg.bugDescription,
                                                bg.assignedTo, 
                                                bg.bugDate 
                                            FROM BugTrackerDB.Bug bg
                                            LEFT JOIN Project prj ON bg.idProject=prj.idProject
                                            WHERE bg.deletedFlag=0
                                            ORDER BY prj.projectName ASC, bg.bugDate DESC`);
  res.json({ message: "GET bug - success!",
             data });
});

// app.get('/bug/:id', authenticateJWT, async (req, res) => {
//   // const user = req.user;
//   const idBug = req.params.idBug;
//   console.log('idBug: ', idBug);
//   const [data] = await global.db.query(`SELECT  prj.projectName,
//                                                 bg.idProject,
//                                                 bg.idBug, 
//                                                 bg.idUser, 
//                                                 bg.bugTitle,
//                                                 bg.bugDescription,
//                                                 bg.assignedTo, 
//                                                 bg.bugDate 
//                                             FROM BugTrackerDB.Bug bg
//                                             LEFT JOIN Project prj ON bg.idProject=prj.idProject
//                                             WHERE bg.deletedFlag=0 AND bg.idBug=?
//                                             ORDER BY prj.projectName ASC, bg.bugDate DESC`,
//                                         [ idBug ]
//                                         );
//   res.json({ message: "GET bug - success!",
//              data });
// });


//-- ADD a Bug
app.post('/bug', authenticateJWT, async function(req, res) {
// app.post('/bug', async function(req, res) {
  const user = req.user;
  const { 
          idProject, 
          bugTitle, 
          bugDescription, 
          assignedTo
        } = req.body;
  const [data] = await global.db.query(`INSERT INTO Bug(  
                                                          idUser,
                                                          idProject, 
                                                          bugTitle, 
                                                          bugDescription, 
                                                          assignedTo, 
                                                          bugDate,
                                                          deletedFlag
                                                       )
                                              VALUES(?, ?, ?, ?, ?, NOW(), 0)`,
                                        [
                                          user.idUser,
                                          idProject, 
                                          bugTitle, 
                                          bugDescription, 
                                          assignedTo
                                        ]
  );
  res.json({ message: "Success! New bug has been added!",
             data });
});

//-- UPDATE Bug
app.put('/bug', authenticateJWT, async function(req, res) {
  const user = req.user;
  console.log('User: ', user);
  const { idBug, 
          bugTitle, 
          bugDescription, 
          assignedTo } = req.body;
  const [data] = await global.db.query(`UPDATE Bug SET bugTitle=?,
                                                       bugDescription=?,
                                                       assignedTo=?,
                                                       bugDate=NOW()
                                                WHERE idUser=? AND
                                                      idBug=?  AND
                                                      deletedFlag=0`,
                                        [ 
                                          bugTitle, 
                                          bugDescription,
                                          assignedTo,
                                          user.idUser, 
                                          idBug
                                        ]
  );
  res.json({ message: "Success! Bug has been updated.",
             data });
});

//-- "DELETE" Bug - assert deletedFlag
app.delete('/bug', authenticateJWT, async function(req, res) {
  const user = req.user;
  const { idBug } = req.body;
  const [data] = await global.db.query(`UPDATE Bug SET bugDate=NOW(),
                                                       deletedFlag=1
                                                       WHERE idUser=? AND idBug=?`,
                                        [ 
                                          user.idUser, 
                                          idBug
                                        ]
  );
  res.json({ message: "Success! Bug has been deleted.",
             data });
});
// //-- DELETE Bug - Irreversible
// app.delete('/bug', authenticateJWT, async (req, res) => {
//   const user = req.user;
//   console.log('idUser: ', user);
//   const { idBug } = req.body;
//   const [data] = await global.db.query(`DELETE FROM Bug WHERE idUser=? AND idBug=?`,
//                                         [user.idUser, idBug]);
//   res.json({ message: "Success! Bug has been deleted",
//              data });
// });


//-- GET all comments for a bug
app.get('/comment/:idBug', authenticateJWT, async (req, res) => {
  const idBug = req.params.idBug;
  console.log('req.params.idBug: ', req.params.idBug);
  const [data] = await global.db.query(`SELECT idProject, notes, date 
                                            FROM Comments
                                            WHERE idBug=?
                                            ORDER BY date DESC`,
                                        [ idBug ]
                                      );
  res.json({ message: "GET comments - success!",
             data });
});


// //-- GET Brands
// app.get('/brand', async (req, res) => {
//   const { idBrand } = req.body;
//   // console.log('idBrand: ', idBrand);
//   const [data] = await global.db.query(`SELECT p.idProduct, p.pName, p.pDescription, b.brandName 
//                                             FROM ProductsDB.Product p
//                                             LEFT JOIN Brand b ON p.idBrand=b.idBrand
//                                             WHERE p.idBrand=?`,
//                                             [idBrand]);
//   res.json({ message: "GET brand - success!", 
//              data });
// });



//-- ADD a comment
app.post('/comment', authenticateJWT, async function(req, res) {
  const user = req.user;
  // console.log("User: ", user);
  const { idProject, 
          idBug, 
          notes } = req.body;
  // console.log(idProject, idBug, notes);
  const [data] = await global.db.query(`INSERT INTO Comments(
                                                            idUser,
                                                            idProject, 
                                                            idBug, 
                                                            notes, 
                                                            date,
                                                            deletedFlag
                                                           )
                                              VALUES(?, ?, ?, ?, NOW(), 0)`,
                                        [
                                          user.idUser, 
                                          idProject,
                                          idBug,
                                          notes
                                        ]
  );
  res.json({ message: "Success! Comment has been added!",
             data });
});

//-- UPDATE Comment
app.put('/comment', authenticateJWT, async function(req, res) {
  const user = req.user;
  // console.log('User: ', user);
  const { idProject,
          notes, 
          idBug } = req.body;
  const [data] = await global.db.query(`UPDATE Comments SET idProject=?,
                                                       notes=?,
                                                       date=NOW()
                                                WHERE idUser=? AND
                                                      idBug=?  AND
                                                      deletedFlag=0`,
                                        [ 
                                          idProject,
                                          notes, 
                                          user.idUser,
                                          idBug
                                        ]
  );
  res.json({ message: "Success! Comment has been updated.",
             data });
});

//-- "DELETE" Comment - assert deletedFlag
app.delete('/comment', authenticateJWT, async function(req, res) {
  const user = req.user;
  const { idComment } = req.body;
  const [data] = await global.db.query(`UPDATE Comments SET date=NOW(),
                                                            deletedFlag=1
                                                WHERE idUser=? AND idComment=?`,
                                        [ 
                                          user.idUser, 
                                          idComment
                                        ]
  );
  res.json({ message: "Success! Comment has been deleted.",
             data });
});
// //-- DELETE Bug - Irreversible
// app.delete('/comment', authenticateJWT, async (req, res) => {
//   const user = req.user;
//   // console.log('idUser: ', user);
//   const { idComment } = req.body;
//   const [data] = await global.db.query(`DELETE FROM Comments WHERE idUser=? AND idComment=?`,
//                                         [user.idUser, idComment]);
//   res.json({ message: "Success! Comment has been deleted",
//              data });
// });

// //-- GET all comments from a bug report
// app.get('/comment', authenticateJWT, async (req, res) => {
//   const user = req.user;
//   const { idBug } = req.body;
//   const [data] = await global.db.query(`SELECT idProject, notes, date 
//                                             FROM Comments
//                                             WHERE idUser=? AND idBug=?`,
//                                             [
//                                               user.idUser,
//                                               idBug
//                                             ]);
//   res.json({ message: "GET comments - success!",
//              data });
// });


//-- Listen on PORT
app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
  });



//  const express = require('express');
//  const bodyParser = require('body-parser');
//  const cors = require('cors');
//  const mysql = require('mysql2/promise');
//  const morgan = require('morgan');
//  const bcrypt = require('bcrypt');
//  const jwt = require('jsonwebtoken');
 
//  const app = express();

//  //-- Display REST API commands
//  app.use(morgan('short'));
 
//  //-- Get access to values in the .env file
//  //-- Import and load '.env' file
//  require('dotenv').config();  // equivalent to lines below
//  // const dotenv = require('dotenv');
//  // dotenv.config();

//  //-- Use process.env to access the variables in '.env' file
//  const pool = mysql.createPool({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME
//  });

//  const port = process.env.PORT;

// app.use(async function mysqlConnection(req, res, next) {
//   try {
//     req.db = await pool.getConnection();
//     req.db.connection.config.namedPlaceholders = true;

//     //-- Traditional mode ensures not null is respected for unsupplied
//     //-- fields, ensures valid JavaScript dates, etc.
//     await req.db.query('SET SESSION sql_mode = "TRADITIONAL"');
//     await req.db.query(`SET time_zone = '-8:00'`);

//     //-- Go to the rest of the middleware until it hits an endpoint 
//     await next();

//     //-- Returns to here after it finishes the endpoint to release the db connection
//     req.db.release();
//   } catch(err) {
//     //-- If anything downstream throws an error, we must release the 
//     //-- connection allocated for the request
//     console.log('ERROR detected');
//     console.log(err);
//     if (req.db) req.db.release();
//     throw err;
//   }
// });

// app.use(cors());
 
// app.use(bodyParser.json());

// app.get('/users', async function(req, res) {
//   try {
//     console.log('GET /users endpoint');
//     //-- GET an ARRAY of car objects
//     const [users] = await req.db.query("SELECT * FROM users");
//     // res.json({message: "ALL rows returned. ", users});
//     res.json(users);
//   } catch(err) {
//     console.log('Error caught - GET request');
//   }
// });

// app.get('/users/:id', async function(req, res) {
//   try {
//     console.log('GET /users/:id endpoint');
//     const { id } = req.params;
//     //-- GET an individual car OBJECT that matches the ID
//     const [[user]] = await req.db.query(
//           "SELECT * FROM users WHERE id = :id", {id});
//     // res.json({message: "Returned user: ", user});
//     res.json(user);
//   } catch(err) {
//     console.log('Error caught - GET /user/:id request');
//   }
// })

// //-- ***** NEED to verify that email doesn't currently exist *****
// //-- Public endpoints - user doesn't need to be authenticated 
// app.post('/register', async function(req, res) {
//   try { 
//     let user;
//     //-- Pass in the password to get the password hash
//     //-- then insert into the database
//     bcrypt.hash(req.body.password, 10).then(async hash => {
//         try {
//           const { fname, lname, email, deleted_flag } = req.body;
//           [user] = await req.db.query(
//             `INSERT INTO users(fname, lname, email, password, deleted_flag)
//                 VALUES(:fname, :lname, :email, :password, :deleted_flag)`,
//                   {
//                     fname,
//                     lname,
//                     email,
//                     password: hash,
//                     deleted_flag                  
//                   }
//           )
//           console.log("\n\n***** DEBUG point *****\n\n");
//         } catch(err) {
//             console.log('/register ERROR', err);
//         }
//     });
//     //-- Convert to a string
//     const encodedUser = jwt.sign(req.body, process.env.JWT_KEY);

//     res.json(encodedUser);
//   } catch(err) {

//   }
// });

// app.put('/users/:id', async function(req, res){
//   try {
//     let user;
//     bcrypt.hash(req.body.password, 10).then(async hash => {
//       try {
//         const { fname, lname, email, deleted_flag } = req.body;
//         const { id } = req.params;
//         const [user] = await req.db.query(
//             `UPDATE users SET fname = :fname, 
//                               lname = :lname,
//                               email = :email,
//                               password = :password,
//                               deleted_flag = :deleted_flag
//                               WHERE id = :id`, 
//                             { 
//                               fname, 
//                               lname,
//                               email,
//                               password: hash,
//                               deleted_flag,
//                               id 
//                             }
//         );
//         res.json({message: 'User ID: ' + id + ' has been UPDATED', user});
//       } catch (err){
//         console.log(err)
//       }
//     });
//     //-- Convert to a string
//     const encodedUser = jwt.sign(req.body, process.env.JWT_KEY);

//     res.json(encodedUser);
//   } catch(err) {

//   }
// });

// app.delete('/users/:id', async function(req, res){
//   try {
//       const { id } = req.params;
//       const [user] = await req.db.query(
//           `UPDATE users SET deleted_flag = 1 
//               WHERE id = :id`, {id}
//       );
//       res.json({message: 'User ID: ' + id + ' has been DELETED', user});
//   } catch (err){
//       console.log(err)
//   }
// });


//  //===============================================
//  // Listen for requests
//  //===============================================
//  app.listen(port, () => console.log(`API Example listening on http://localhost:3000`));


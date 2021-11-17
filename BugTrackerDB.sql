CREATE TABLE `BugTrackerDB`.`Users` (
  `idUser` INT NOT NULL AUTO_INCREMENT,
  `fName` VARCHAR(45) NULL,
  `lName` VARCHAR(45) NULL,
  `email` VARCHAR(45) NULL,
  `password` VARCHAR(255) NULL,
  `deletedFlag` VARCHAR(45) NULL,
  PRIMARY KEY (`idUser`));

SELECT * FROM BugTrackerDB.Users;


CREATE TABLE `BugTrackerDB`.`Bug` (
  `idBug` INT NOT NULL AUTO_INCREMENT,
  `idProject` INT NULL,
  `idUser` INT NULL,
  `bugTitle` VARCHAR(45) NULL,
  `bugDescription` VARCHAR(255) NULL,
  `assignedTo` VARCHAR(45) NULL,
  `bugDate` DATETIME NULL,
  `deletedFlag` BIT(1) NULL,
  PRIMARY KEY (`idBug`));

CREATE TABLE `BugTrackerDB`.`Comments` (
  `idComments` INT NOT NULL AUTO_INCREMENT,
  `idProject` VARCHAR(45) NULL,
  `idBug` VARCHAR(45) NULL,
  `idUser` VARCHAR(45) NULL,
  `notes` VARCHAR(255) NULL,
  `date` DATETIME NULL,
  `deletedFlag` BIT(1) NULL,
  PRIMARY KEY (`idComments`));

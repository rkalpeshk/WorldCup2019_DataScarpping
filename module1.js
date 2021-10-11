// npm init
// npm install minimist
// npm install axios
// npm install jsdom 
// npm install excel4node
// npm install pdf-lib

// node module1.js --url=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results  --excel=excelFile.xls --dataDir=WorldCup

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let fs = require("fs");
let excel = require("excel4node");
let path = require("path");
let pdf = require("pdf-lib");
let arg = minimist(process.argv);


// url is https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results
let responseKaPromise = axios.get(arg.url);

responseKaPromise.then(function (response) {
    let html = response.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    let matches = [];
    let matchBlock = document.querySelectorAll("div.match-score-block");
    let teams = [];
    // Creating Match object with details. 
    for (let i = 0; i < matchBlock.length; i++) {
        let match = {};

        let teamsName = matchBlock[i].querySelectorAll("p.name");
        match.t1 = teamsName[0].textContent;
        match.t2 = teamsName[1].textContent;

        let teamsScore = matchBlock[i].querySelectorAll("div.score-detail > span.score");
        if (teamsScore.length == 2) {
            match.score1 = teamsScore[0].textContent;
            match.score2 = teamsScore[1].textContent;
        } else if (teamsScore.length == 1) {
            match.score1 = teamsScore[0].textContent;
            match.score2 = " ";
        } else {
            match.score1 = " ";
            match.score2 = " ";
        }

        let res = matchBlock[i].querySelector("div.status-text");
        match.result = res.textContent;
        matches.push(match);
    }
    // Putting every team in different sheet
    for (let j = 0; j < matches.length; j++) {
        putTeamInDifferentSheet(teams, matches[j]);
    }

    // Putting every team match detail in sheet
    for (let j = 0; j < matches.length; j++) {
        putMatchDetailInSheet(teams, matches[j]);
    }


    // Writing match data in json
    let matchesDataJson = JSON.stringify(matches);
    fs.writeFileSync("matchesData.json", matchesDataJson, "utf-8");

    // Writing teams data in json
    let teamDataJson = JSON.stringify(teams);
    fs.writeFileSync("teamsData.json", teamDataJson, "utf-8");

    writeExcel(teams);

    prepareFolderAndPdf(teams, arg.dataDir);
}
).catch(function (error) {
    console.log(error);
})


function prepareFolderAndPdf(teams, dataDir) {
    if (fs.existsSync(dataDir) == false) {
        fs.mkdirSync(dataDir);
    }

    for (let i = 0; i < teams.length; i++) {
        let teamFolderName = path.join(dataDir, teams[i].name);
        if (fs.existsSync(teamFolderName) == false) {
            fs.mkdirSync(teamFolderName);
        }
        for (let j = 0; j < teams[i].matches.length; j++) {
            let match = teams[i].matches[j];
            createMatchScoreCardPdf(teamFolderName, match, teams[i].name);
        }
    }
}

function createMatchScoreCardPdf(teamFolderName, match, myTeamName) {

    let matchFileName = path.join(teamFolderName, match.oppName);

    let basePdfByte = fs.readFileSync("basePdf.pdf");
    let pdfDocKaPromise = pdf.PDFDocument.load(basePdfByte);

    pdfDocKaPromise.then(function (pdfDoc) {
        let page = pdfDoc.getPage(0);
        page.drawText(myTeamName, { x: 320, y: 600, size: 20 });
        page.drawText(match.oppName, { x: 320, y: 565, size: 20 });
        page.drawText(match.myScore, { x: 320, y: 530, size: 20 });
        page.drawText(match.oppScore, { x: 320, y: 495, size: 20 });
        page.drawText(match.result, { x: 320, y: 460, size: 20 });

        let changeBytesKaPromise = pdfDoc.save();

        changeBytesKaPromise.then(function (changeByte) {
            if (fs.existsSync(matchFileName + ".pdf")) {
                fs.writeFileSync(matchFileName + "1.pdf", changeByte)
            } else {
                fs.writeFileSync(matchFileName + ".pdf", changeByte)
            }
        });

    });
}

function writeExcel(teams) {
    let wb = new excel.Workbook();
    for (let i = 0; i < teams.length; i++) {
        let sheet = wb.addWorksheet(teams[i].name);

        sheet.cell(1, 1).string("Opp_Team");
        sheet.cell(1, 2).string("My_Score");
        sheet.cell(1, 3).string("Opp_Score");
        sheet.cell(1, 4).string("Result");

        for (let j = 0; j < teams[i].matches.length; j++) {

            let Opp_Team = teams[i].matches[j].oppName;
            let My_Score = teams[i].matches[j].myScore;
            let Opp_Score = teams[i].matches[j].oppScore;
            let Result = teams[i].matches[j].result;

            sheet.cell(j + 2, 1).string(Opp_Team);
            sheet.cell(j + 2, 2).string(My_Score);
            sheet.cell(j + 2, 3).string(Opp_Score);
            sheet.cell(j + 2, 4).string(Result);
        }
    }
    wb.write(arg.excel);
}

function putTeamInDifferentSheet(teams, match) {
    let t1ind = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t1) {
            t1ind = i;
            break;
        }
    }
    if (t1ind == -1) {
        teams.push({ name: match.t1, matches: [] });
    }

    let t2ind = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t2) {
            t2ind = i;
            break;
        }
    }
    if (t2ind == -1) {
        teams.push({ name: match.t2, matches: [] });
    }

}

function putMatchDetailInSheet(teams, match) {

    let t1ind = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t1) {
            t1ind = i;
            break;
        }
    }

    teams[t1ind].matches.push({
        myScore: match.score1,
        oppScore: match.score2,
        oppName: match.t2,
        result: match.result
    });

    let t2ind = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t2) {
            t2ind = i;
            break;
        }
    }
    teams[t2ind].matches.push({
        myScore: match.score2,
        oppScore: match.score1,
        oppName: match.t1,
        result: match.result
    });

}
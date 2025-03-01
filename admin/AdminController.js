import InfluencersSchema from '../influencers/InfluencersSchema.js';
import multer from 'multer';
import cloudinary from 'cloudinary';
import _ from 'lodash';
import puppeteer, { Puppeteer } from 'puppeteer';
import OpenAI from "openai";
import dotenv from 'dotenv';
dotenv.config();

const storage = multer.diskStorage({});
const upload = multer({ storage }); 
const hunterIoApiKey = process.env.HUNTER_IO_API_KEY;
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
const openAiApiKey = process.env.OPENAI_API_KEY;
//Configure Cloudinary
cloudinary.config({
    cloud_name: 'dza3ed8yw',
    api_key: cloudinaryApiKey,
    api_secret: cloudinaryApiSecret
});

// Initialize the OpenAI client with your API key
const openai = new OpenAI({
    apiKey: openAiApiKey, // Replace with your OpenAI API key
});


// Function to fetch emails by domain
const getEmailsByDomain = async(firstName, domain) => {
    const match = domain.match(/:\/\/(?:www\.)?([^/]+)/);
    const domainEmail = match ? match[1] : null;
    const possibleEmail = `${firstName}${'@'}${domainEmail}`;

    const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterIoApiKey}`;
    const url2 = `https://api.hunter.io/v2/email-verifier?email=${possibleEmail}&api_key=${hunterIoApiKey}`;

    try {
        // Make the GET request
        const response = await fetch(url);

        // Check if the response contains emails
        if (response) {
            if(_.isEmpty(response?.data?.emails)) {
                const response2 = await fetch(url2);

                return response2.json() || null;
            }
            return response.json();
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
}

// Async function to make the request
const isCorrectInfluencerType = async(bio, profileName, category) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `Can you parse this Instagram influencers account bio "${bio}" and profile name "${profileName}", and tell me if this influencer is 
                    a ${category}. Can you please reply with only an array. If this influencer is a ${category}, please reply with only "true" 
                    as the first element in the array. If this influencer is not a ${category}, please reply with only "false" as the first 
                    element in the array. Next, if you see any emails listed in their bio, please inject an array with any emails found as the second element
                    in the array you return. if you do not see any emails listed in their bio, please inject an empty array as the second element
                    in the array that you return. So you should only be returning an array with those 2 values inside.`
                },
            ],
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
    }
}

const getInfluencersRealNameLastTry = async(username, bio, bioLink) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `This instagram influencers account username is "${username}", their bio link is "${bioLink}", and their bio says "${bio}". Judging by their username bio link and bio text, can you detect this instagram influencers first name? Or first and last name if possible. If you are able to detect a name, please reply with only their name. If you are not able to detect a name, please reply with only "null".`
                },
            ],
        });

        return completion.choices[0].message.content;
    } catch (error) {  
        return [];
    }
}

const getInfluencersRealName = async(name, category, username, bio, bioLink) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `Can you parse this Instagram influencers name from this text "${name}"? This influencer is 
                    a ${category}. The first and last name should be present but sometimes only the first name will be present. 
                    If you can parse their name, please reply with only their name. If a name is not present, please 
                    reply with only "null".` 
                },
            ],
        });

        if(completion.choices[0].message.content === null || completion.choices[0].message.content === 'null') {
            const completion2 = await openai.chat.completions.create({
                model: "gpt-4",
                store: true,
                messages: [
                    { 
                        role: "user", 
                        content: `This instagram influencers account username is "${username}", their bio link is "${bioLink}", and their bio says "${bio}". Judging by their username bio link and bio text, can you detect this instagram influencers first name? Or first and last name if possible. If you are able to detect a name, please reply with only their name. If you are not able to detect a name, please reply with only "null".`
                    },
                ],
            });
    
            return completion2.choices[0].message.content;
        }
        return completion.choices[0].message.content;
    } catch (error) {
    }
}

const isAvatarAPerson = async(url) => {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Replace with the appropriate model, if needed
        messages: [
            {
                role: "user",
                content: [
                    { 
                        type: "text", 
                        text: `Here is the link to an instagram influencers profile picture/avatar. I have a list of instagram 
                        influencer pages but some pages are fake and some are company pages. I want to filter out both. 
                        I only want pages that are real and ran by a person/the influencer themself. Typically if the 
                        pages' profile picture is not a person/the influencer themself, then it's either a fake page or 
                        a company page. If this url is a picture of a person/the influencer themself then please reply 
                        with only "true". If it is not a picture of a person, then please reply with only "false".` 
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: url
                        },
                    },
                ],
            },
        ],
        max_tokens: 300,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
  }
}

const scrapeForInfluencersWebsiteDomain = async(links, name, category) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `"${links}", do any of the links in this array point to the official business website of instagram influencer "${name}" who is a "${category}"? If you can detect the business website link, reply with only the link. if you cannot detect the link, then reply with only "null". Please return only 1 link.`
                },
            ],
        });

        return completion.choices[0].message.content;
    } catch (error) {
    }
}

const identifyLinkType = async(link, name, category) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `Is "${link}" a mini-site that allows influencers, businesses, and individuals to share multiple links in one place, or is it a direct link to the official business website of instagram influencer "${name}" who is a "${category}" ? If it is a mini-site please reply with only "MINI-SITE". If it is a business website please reply with only "BUSINESS-SITE". If it is neither a mini-site link or official business website link, then please reply with only "null".`
                },
            ],
        });

        return completion.choices[0].message.content;
    } catch (error) {
    }
}

const scrapeBioLinkForMoreLinks = async(url) => {
    try {
      return await scrapeLink(url);
  } catch (error) {
    return []
  }
}

const getUsername = async(url) => {
    const urlObj = new URL(url); // Create a URL object
    const parts = urlObj.pathname.split("/").filter(Boolean); // Get path parts
    return parts[0]; // The first non-empty part is the username
  }

const testImportFile = async(req, res, next) => {
    const csv = req.body;
    
    for(let influencer of csv) {
      if(!await InfluencersSchema.findOne({usernameIG: influencer.username}) && Number(influencer.followersCount) >= 1000) { //change to IS_ADDED later?
        //ADD FOLLOWERS VALIDATION (>5k)
        const isCorrectInfluencerTypeData = await isCorrectInfluencerType(influencer.biography, influencer.fullName, influencer.category);
        const isCorrectInfluencer = isCorrectInfluencerTypeData[0];
        if(isCorrectInfluencer === true || isCorrectInfluencer  === 'true') {
            const isAvatarAPersonResult = await isAvatarAPerson(influencer.profilePicUrl);
            if(isAvatarAPersonResult === true || isAvatarAPersonResult === 'true') {
                const influencerToAdd = {};
                const emails = [];
                const emailsSeen = [];
                const emailsInBio = isCorrectInfluencerTypeData[1];
                let influencersRealName = await getInfluencersRealName(influencer.fullName, influencer.category, influencer.username, influencer.biography, influencer.externalUrl);
                const bioLinkFound = influencer.externalUrl ? await scrapeBioLinkForMoreLinks(influencer.externalUrl) : null;
                if(bioLinkFound) {
                    const linkType = await identifyLinkType(bioLinkFound, influencersRealName, influencer.category);
                    if(String(linkType) === 'MINI-SITE') {
                        const getInfuencersWebsiteDomain = await scrapeForInfluencersWebsiteDomain(bioLinkFound, influencersRealName, influencer.category);
                        if(getInfuencersWebsiteDomain !== 'null' && getInfuencersWebsiteDomain !== null) {
                            influencerToAdd.domain = getInfuencersWebsiteDomain;
                        }
                    } else if(String(linkType) === 'BUSINESS-SITE') {
                        influencerToAdd.domain = bioLinkFound;
                    }
                } else {
                    influencerToAdd.domain = null;
                }

                influencerToAdd.usernameIG = influencer.username;
                influencerToAdd.firstName = influencersRealName.split(' ')[0];
                influencerToAdd.lastName = influencersRealName.split(' ')[1] || null;
                influencerToAdd.profileUrlIG = influencer.inputUrl;
                influencerToAdd.followersIG = formatNumberToSuffix(Number(influencer.followersCount));
                influencerToAdd.followersIGNum = Number(influencer.followersCount); //convertToNumber(String(followersIG)) || 0;

                //find emails using the hunter.io API & import into Influencer object
                if(influencerToAdd.domain && influencerToAdd.firstName) {
                    const hunterIoData = await getEmailsByDomain(influencerToAdd.firstName, influencerToAdd.domain); //can also extract youtube, facebook, x, tiktok urls!!!!
                    const emailList = hunterIoData?.data?.emails || hunterIoData?.data?.email;
                    if(_.isArray(emailList)) {
                        emailList?.forEach(email => emails.push(email.value));
                        if(emailsInBio.length) {
                            emailsInBio.forEach((email) => {
                                if(!emailsSeen.includes(email)) {
                                    emails.push(email);
                                    emailsSeen.push(email);
                                }
                            });
                        }
                    } else {
                        emails.push(emailList)
                    }
                    
                    influencerToAdd.emails = emails;
                    influencerToAdd.profileUrlFacebook = hunterIoData?.data?.facebook;
                    influencerToAdd.profileUrlX = hunterIoData?.data?.twitter;
                    influencerToAdd.profileUrlYoutube = hunterIoData?.data?.youtube;
                    influencerToAdd.profileUrlLinkedIn = hunterIoData?.data?.linkedin;
                } else {
                    influencerToAdd.emails = [];
                }

                // Upload profile pic to Cloudinary API & then save Cloudinary url in MongoDB
                try {
                    const cloudinaryImg = await cloudinary.uploader.upload(influencer.profilePicUrl);
                    influencerToAdd.profilePic = cloudinaryImg;
                } catch(error) {

                }

                influencerToAdd.followersTotal = influencerToAdd.followersIG;
                influencerToAdd.followersTotalNum = influencerToAdd.followersIGNum;
                influencerToAdd.category = influencer.category;

                //CALCULATE INFLUENCERS ENGAGEMENT RATE (last 10 posts)
                const latestPost0CommentsCount = Number(influencer['latestPosts/0/commentsCount']) || 0;
                const latestPost0LikesCount = Number(influencer['latestPosts/0/likesCount']) || 0;
                //const latestPost0VideoView = Number(influencer['latestPosts/0/videoViewCount']) || 0;
                const totalPost0 = (latestPost0CommentsCount + latestPost0LikesCount);

                const latestPost1CommentsCount = Number(influencer['latestPosts/1/commentsCount']) || 0;
                const latestPost1LikesCount = Number(influencer['latestPosts/1/likesCount']) || 0;
                //const latestPost1VideoView = Number(influencer['latestPosts/1/videoViewCount']) || 0;
                const totalPost1 = (latestPost1CommentsCount + latestPost1LikesCount);

                const latestPost2CommentsCount = Number(influencer['latestPosts/2/commentsCount']) || 0;
                const latestPost2LikesCount = Number(influencer['latestPosts/2/likesCount']) || 0;
                //const latestPost2VideoView = Number(influencer['latestPosts/2/videoViewCount']) || 0;
                const totalPost2 = (latestPost2CommentsCount + latestPost2LikesCount);

                const latestPost3CommentsCount = Number(influencer['latestPosts/3/commentsCount']) || 0;
                const latestPost3LikesCount = Number(influencer['latestPosts/3/likesCount']) || 0;
                //const latestPost3VideoView = Number(influencer['latestPosts/3/videoViewCount']) || 0;
                const totalPost3 = (latestPost3CommentsCount + latestPost3LikesCount);

                const latestPost4CommentsCount = Number(influencer['latestPosts/4/commentsCount']) || 0;
                const latestPost4LikesCount = Number(influencer['latestPosts/4/likesCount']) || 0;
                //const latestPost4VideoView = Number(influencer['latestPosts/4/videoViewCount']) || 0;
                const totalPost4 = (latestPost4CommentsCount + latestPost4LikesCount);

                const latestPost5CommentsCount = Number(influencer['latestPosts/5/commentsCount']) || 0;
                const latestPost5LikesCount = Number(influencer['latestPosts/5/likesCount']) || 0;
                //const latestPost5VideoView = Number(influencer['latestPosts/5/videoViewCount']) || 0;
                const totalPost5 = (latestPost5CommentsCount + latestPost5LikesCount);

                const latestPost6CommentsCount = Number(influencer['latestPosts/6/commentsCount']) || 0;
                const latestPost6LikesCount = Number(influencer['latestPosts/6/likesCount']) || 0;
                //const latestPost6VideoView = Number(influencer['latestPosts/6/videoViewCount']) || 0;
                const totalPost6 = (latestPost6CommentsCount + latestPost6LikesCount);

                const latestPost7CommentsCount = Number(influencer['latestPosts/7/commentsCount']) || 0;
                const latestPost7LikesCount = Number(influencer['latestPosts/7/likesCount']) || 0;
                //const latestPost7VideoView = Number(influencer['latestPosts/7/videoViewCount']) || 0;
                const totalPost7 = (latestPost7CommentsCount + latestPost7LikesCount);

                const latestPost8CommentsCount = Number(influencer['latestPosts/8/commentsCount']) || 0;
                const latestPost8LikesCount = Number(influencer['latestPosts/8/likesCount']) || 0;
                //const latestPost8VideoView = Number(influencer['latestPosts/8/videoViewCount']) || 0;
                const totalPost8 = (latestPost8CommentsCount + latestPost8LikesCount);

                const latestPost9CommentsCount = Number(influencer['latestPosts/9/commentsCount']) || 0;
                const latestPost9LikesCount = Number(influencer['latestPosts/9/likesCount']) || 0;
                //const latestPost9VideoView = Number(influencer['latestPosts/9/videoViewCount']) || 0;
                const totalPost9 = (latestPost9CommentsCount + latestPost9LikesCount);

                const latestPost10CommentsCount = Number(influencer['latestPosts/10/commentsCount']) || 0;
                const latestPost10LikesCount = Number(influencer['latestPosts/10/likesCount']) || 0;
                //const latestPost10VideoView = Number(influencer['latestPosts/10/videoViewCount']) || 0;
                const totalPost10 = (latestPost10CommentsCount + latestPost10LikesCount);

                const totalEngagement = 
                    (totalPost0 + totalPost1 + totalPost2 + totalPost3 + totalPost4 + totalPost5 +
                     totalPost6 + totalPost7 + totalPost8 + totalPost9 + totalPost10);

                const engagementRate = (totalEngagement / influencerToAdd.followersIGNum) * 100;
                influencerToAdd.engagement = parseFloat(engagementRate.toFixed(1));

                influencerToAdd.platform = influencer.platform;
                influencerToAdd.city = influencer.city;
                influencerToAdd.state = influencer.state;
                influencerToAdd.country = influencer.country;

                influencerToAdd.updatedDate = new Date().toLocaleString();
                if(areAllRowsValid(influencerToAdd)) {
                    //await InfluencersSchema.create(influencerToAdd);
                }
            }
        }
      }
    }
}

const scrapeProfileLinks = async(username) => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Go to the Instagram profile page
        const profileUrl = `https://www.instagram.com/${username}/`;
        await page.goto(profileUrl, { waitUntil: 'networkidle2' });

        // Wait for the main content to load
        await page.waitForSelector('a');

        // Extract all links on the page
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
            .map(a => a.href)
            .filter(href => !href.includes('instagram.com')); // Exclude Instagram links
        });

        return links;

    } catch (error) {
        return null;
    } finally {
        await browser.close();
    }
}

const formatNumberToSuffix = (num) => {
    if (num < 1000) {
      return num.toString(); // Numbers less than 1000 stay as-is
    }
  
    const suffixes = [
      { value: 1_000_000, symbol: 'M' },    // Million
      { value: 1_000, symbol: 'K' }         // Thousand
    ];
  
    for (const { value, symbol } of suffixes) {
      if (num >= value) {
        return (num / value).toFixed(1).replace(/\.0$/, '') + symbol;
      }
    }
  
    return num.toString(); // Fallback (not likely needed)
}


const convertToNumber = (input) => {
    // Define multipliers for suffixes
    const suffixMultiplier = {
        k: 1000, // Thousand
        m: 1000000, // Million
        b: 1000000000 // Billion
      };
    
      // Convert input to lowercase
      const normalizedInput = _.toLower(input);
    
      // Check for a valid suffix and multiply accordingly
      for (const [suffix, multiplier] of Object.entries(suffixMultiplier)) {
        if (_.endsWith(normalizedInput, suffix)) {
          const numericPart = parseFloat(normalizedInput.replace(suffix, ''));
          return numericPart * multiplier;
        }
      }
    
      // Return the number directly if no suffix is found
      return parseFloat(input);
}

const areAllRowsValid = ((influencer) => {
    if(influencer.firstName && influencer.usernameIG && influencer.profilePic && 
       influencer.followersTotal && influencer.category && influencer.updatedDate) {
        return true;
    }
    return false;

});

const getUsernameFromUrl = ((csv) => {
    const usernames = [];
    for(let influencer of csv) {
        const url = influencer['ACCOUNT_URL'];
        const match = url.match(/instagram\.com\/([^/]+)\/?$/);
        const username = match ? match[1] : null;
        if(username) {
            usernames.push(username);
        }
    }
    return usernames;
});

const updateInfluencersInDB = async(req, res, next) => {
    const request = req;
    const influencers = await InfluencersSchema.find(request.query);
}

const addInfluencersToDB = async(req, res, next) => {
    const request = req;
    const influencersToScrape = [];
    for(let influencer of influencersToScrape) {
        if(this.canAddInfluencer()) { //scrape profile data to see if influencer is a good fit for Distros DB

        }
    }
}

const getUpdatedDataFromApify = async(req, res, next) => {
    /*
    {
        //can only fetch 2173 per transaction
        "usernames": [
            "humansofny"
        ]
    }
    */
}


const scrapeLink = async(url) => {
    // Launch browser
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Navigate to the URL
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Extract all links
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => a.href);
    });

    // Close browser
    await browser.close();

    return links;
}

const canAddInfluencer = async(req, res, next) => {
    
}

export { updateInfluencersInDB, addInfluencersToDB, testImportFile, convertToNumber, formatNumberToSuffix, getUpdatedDataFromApify };
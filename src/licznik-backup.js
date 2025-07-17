var backupPostIds = [];
var backupData = "";

async function StartBackup() {

    mainColor = $("header").css("border-top-color");
    backupPostIds = [];
    backupData = "";
    SetInfo("rozpoczynam pracę...");

    var data = await $.ajax({
        type: "GET",
        dataType: "json",
        url: "https://www.dobreprogramy.pl/api/users/nick/" + blogerName + "/"
    });

    await GetDataIdToBackup(GetBaseUrl(0, data.id), 0, data.blogs_count);
}

async function GetDataIdToBackup(linkToSearch, index, blogsCount) {
    var data = await $.ajax({
        url: linkToSearch,
        dataType: "json"
    });

    data.results.forEach(elem => {
        backupPostIds.push(elem.id);
        SetInfo("Odczytuje dane do backupu " + (++index) + "/" + blogsCount + "...");
    });

    if (data.next) {
        GetDataIdToBackup(FixHttpsUrl(data.next), index, blogsCount);
    }
    else {
        var zip = new JSZip();
        await BeginToBackup(zip, 0, blogsCount);
    }
}

async function BeginToBackup(zip, index, blogsCount) {
    
    if ( backupPostIds.length > index) {
        SetInfo("Backup wpisu " + (index + 1) + "/" + blogsCount + "...")
        var data = await $.ajax({
            type: "GET",
            dataType: "json",
            url: "https://www.dobreprogramy.pl/api/blogs/" + backupPostIds[index] + "/"
        });

        await BackupPostFull(data, zip, index, blogsCount);
    }
    else {
        //pobranie
        SetInfo("tworzenie pliku zip, czekaj...");
        zip.generateAsync({ type: "blob" })
            .then(function (content) {
                saveAs(content, "backup_" + blogerName + "_" + new Date().toLocaleDateString() + ".zip");
                SetInfo("backup gotowy!");
            })
    }
}

async function BackupPostFull(data, zip, index, blogsCount) {
    let name = data.id + "_" + data.slug;
    let folder = zip.folder(name);
    //headers
    folder.file(name + ".md", AddHeader(data));
    //content
    folder.file(name + ".html", BlocskLoop(data));
    //images
    await ImgDownloader(data, folder);
    BeginToBackup(zip, index + 1, blogsCount);
}

async function findAllType3Blocks(blocks) {
  let result = [];

  for (const block of blocks) {
    if (block.type === 3) {
      result.push(block);
    }
    if (block.children && Array.isArray(block.children)) {
      const childrenBlocks = await findAllType3Blocks(block.children);
      result = result.concat(childrenBlocks);
    }
  }

  return result;
}

async function ImgDownloader(data, folder) {
  let items = await findAllType3Blocks(data.blocks);
  if (items.length > 0) {
    for (let img of items) {
      if (img.image && img.image.file) {
        const urlParts = img.image.file.split("/");
        const fileName = urlParts[urlParts.length - 1];
        folder.file(fileName, await UrlToPromiseToZip(img.image.file), { base64: true });
      }
    }
  }
}

function AddHeader(data) {
    let header = "";
    header += "---\n";
    header += "layout: post\n";
    header += "title: " + data.title + "\n";
    header += "date: " + data.created_on + "\n";
    header += "summary: " + (data.blocks.find(x => x.type == 1)?.data.text ?? "") + "\n";
    header += "categories: " + data.tags.flatMap(x => x.slug).join(" ") + "\n";
    header += "slug: " + data.slug + "\n";
    header += "thumbnail_image: " + data.thumbnail_image?.file + "\n";
    header += "---\n";
    return header;
}

function BlocskLoop(data) {
    let blocks = data.blocks;
    let html = cdom
        .get("h1")
        .innerHTML(data.title)
        .getHTML();

    html += cdom
        .get("h2")
        .innerHTML(data.created_on)
        .getHTML();

    for (let index = 0; index < blocks.length; index++) {
        html += BlockSwitcher(blocks[index]);
    }
    return html;
}

function BlockSwitcher(block) {
    switch (block.type) {
        case 1:
            return Block_1(block);
        case 2:
            return Block_2(block);
        case 3:
            return Block_3(block);
        case 5:
            return Block_5(block);
        case 6:
            return Block_6(block);
        case 7:
            return Block_7(block);
        case 9:
            return Block_9(block);
        case 14:
            return Block_14(block);
        case 15:
            return Block_15(block);
        case 16:
            return Block_16(block);

        default:
            console.log("LICZNIK BLOGOWY: unknown block type: " + block.type);
            console.log(JSON.stringify(block))
            return "";
    }
}

function Block_1(block) {
    return cdom
        .get("p")
        .innerHTML(block.data.text)
        .getHTML();
}

function Block_3(block) {
    return cdom
        .get("p")
        .append(
            cdom
                .get("img")
                .attribute("alt", block.image.caption)
                .attribute("src", block.image.file))
        .getHTML();
}

function Block_2(block) {
    return cdom
        .get("h" + block.data.level)
        .innerHTML(block.data.text)
        .getHTML();
}

function Block_5(block) {
    return cdom
        .get("blockquote")
        .innerHTML(block.data.text)
        .append(
            cdom
                .get("small")
                .innerHTML("<br />" + block.data.author))
        .getHTML();
}

function Block_6(block) { 

    let list = cdom.get("ul");

    if (block.data.style === "ordered") {
         list = cdom.get("ol");
    }

    for (let index = 0; index < block.data.items.length; index++) {
        let item = block.data.items[index];
        list.append(cdom
            .get("li")
            .innerHTML(item));
    }
    
    return list.getHTML();
}

function Block_7(block) {
    return cdom
        .get("p")
        .append(
            cdom
                .get("samp")
                .innerHTML(block.data.code))
        .getHTML();
}

function Block_9(block) {
    return cdom
        .get("iframe")
        .attribute("width", "800")
        .attribute("height", "600")
        .attribute("src", block.data.url.replace("watch?v=", "embed/"))
        .getHTML();
}

function Block_14(block) {
    let table = cdom
        .get("table");

    for (let index = 0; index < block.data.content.length; index++) {
        let tr = cdom
            .get("tr");
        for (let index2 = 0; index2 < block.data.content[index].length; index2++) {
            tr.append(cdom
                .get("td")
                .innerHTML(block.data.content[index][index2]));
        }
        table.append(tr);
    }
    return table.getHTML();
}

function Block_15(block) {
    return cdom
        .get("hr")
        .getHTML();
}

function Block_16(block) { 
    let innerHtml = "";
    for (let index = 0; index < block.children.length; index++) {
        let item = block.children[index];
        innerHtml += BlockSwitcher(item);
    }
    return innerHtml;
}

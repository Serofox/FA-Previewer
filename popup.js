var dbg = false;

$(document.body).append($('<div id="fa_popup"></div>'));
var popup_div = $($('#fa_popup')[0]);
popup_div.css("z-index", "1024").css("position", "absolute").hide();
var callbacks = {};
var px = -1;
var py = -1;
var hoveredImgSrc = null;

var imgs = $('img');
$.each(imgs, function(_, img) {
  // Make sure it's a submission
  if (!isThumbnail(img)) {
    return;
  }

  var src = $(img).attr('src');
      
  $(img).hoverIntent(
    function(e) {
      //
      // Apparently hover intent gives you the location
      // of mouse /entrance/, not current location...
      // So we update the x and y coordinates of the event
      // object to the latest known position
      //
      
      e.pageX = px;
      e.pageY = py;
      
      mouse_move(e);
      popup(this, e);

      //
      // Hack since the loading image will only appear after
      // you move your mouse again after hoverIntent triggers
      // and I'm too stupid and lazy to figure out why
      //

      mouse_move(e);
    },
    function() {
      px = py = -1;

      hoveredImgSrc = null;
      
      $(popup_div.children("#popup_img")).hide();
      $(popup_div.children("#loading_img")).hide();
      $(popup_div.children("#error_img")).hide();
      popup_div.hide();
    }
  );
  
  img.onmousemove = mouse_move;
});

$(document).ready(function() {
  // Only preload the submissions page
  if (window.location.href.indexOf('msg/submissions') != -1) {
    setTimeout(function() {
      preload();
    }, (1000));
  }

  $('body').keyup(function (e) {
    if (e.which == 83) { // 'S'
      if (hoveredImgSrc != null) {
        downloadImage(hoveredImgSrc);
      }
    }
  })
});

function isThumbnail(img) {
  return $(img).siblings('i.icon').length > 0;
}

function getFullImageSrc(thumbnail, callback) {
  var sid = $(thumbnail).parents('b').first().attr('id');
  if (sid && localStorage[sid]) {
    callback(localStorage[sid]);
    return;
  }

  if (sid && callbacks[sid]) {
    var orig_callback = callbacks[sid];
    callbacks[sid] = function (img_src) {
      orig_callback(img_src);
      callback(img_src);
    }
    return;
  }

  callbacks[sid] = callback;
  var sub_link = $(thumbnail).parents('a').first().attr('href');
  $.ajax(sub_link, {dataType: 'text'})
    .success(function (data) {
      var match = data.match(/var\s+full_url\s*=\s*"([^"]+)"/);
      
      if (match) {
        img_src = match[1];
      }
      
      if (img_src && sid) {
        localStorage[sid] = img_src;
        callbacks[sid](img_src);
      } else {
        console.error("Couldn't find submission image (sid: " + sid +") => " + img_src);
        callbacks[sid](chrome.extension.getURL("error.png"));
        callbacks[sid] = null;
      }
    })
    .error(function (data, text, xhr) {
      console.error('Submission request failed: ' + text + '\n' + data);
      callbacks[sid](chrome.extension.getURL("error.png"));
      callbacks[sid] = null;
    });
}

function id(o) {
  return o;
}

function preload() {
  console.log("Preloading");
  
  var imgs = $('img');
  $.each(imgs, function(_, img) {
    if (!isThumbnail(img)) {
      return;
    }

    getFullImageSrc(img, function(full_src) {
      id(new Image()).src = full_src;
    });
  });
}

function popup(img, e) {
  px = e.pageX;
  py = e.pageY;
  
  var popup_img, loading_img;
  popup_div.height(1).width(1)
    .empty()
    .append(loading_img = $('<img id="loading_img" />'))
    .show();

  // Give the image 100ms to load before showing the loading gif since it can
  // be a bit jarring to have show and immediately disappear
  setTimeout(function () {
    if (popup_div.children("#loading_img").length > 0) {
      loading_img
        .attr('src', chrome.extension.getURL("loading.gif"))
        .data('width', loading_img.attr('width'))
        .data('height', loading_img.attr('height'));
    }
  }, 100);

  popup_img = $('<img id="popup_img"></img>')

  maybeShowDownloadFeatureNotif();

  getFullImageSrc(img, function (img_src) {
    popup_div.append(
      popup_img.attr({src: img_src})
      .load(function() {
        hoveredImgSrc = img_src;
        popup_img.data('width', popup_img.width()).data('height', popup_img.height());
        popup_div.children("#loading_img").remove();
        move_image($(this), px, py);
        $(this).css("border", "solid black 3px").show("fade", {}, 300);
      })
      .error(function() {
        $(popup_div.children("#loading_img")[0]).remove();
        popup_div.append($('<img id="error_img" src="'
        + chrome.extension.getURL("error.png") + '"/>'));
      })
      .hide()
    )
  });
}

function mouse_move(e) {
  px = e.pageX;
  py = e.pageY;

  // Check if we're still loading
  if (popup_div.children('#loading_img').length > 0) {
    popup_div.offset({left: e.pageX - 63, top: e.pageY - 28});
  } else {
    move_image(popup_div.children("#popup_img").first(), e.pageX, e.pageY);
  }
}

function move_image(img, pageX, pageY)
{
  var vp = viewport();
  
  var owidth = img.data('width') || 0;
  var oheight = img.data('height') || 0;

  var show_left = (pageX > vp.x + (vp.cx / 2));

  var max_height = vp.cy - 55;
  if (oheight && oheight != 0) {
    max_height = Math.min(max_height, oheight);
  }
  
  var max_width = show_left ? pageX - vp.x - 45 : vp.cx - (pageX - vp.x) - 45;
  if (owidth && owidth != 0) {
    max_width = Math.min(max_width, owidth);
  }
  
  var ratio = Math.min( max_width / (1.0 * owidth), max_height / (1.0 * oheight));
  
  var width = ratio * owidth;
  var height = ratio * oheight;

  var x, y;
  
  if (pageY + 75 - oheight > vp.y + 25) {
    y = pageY + 75 - height;
  } else {
    y = vp.y + 25;
  }
  
  if (show_left) {
    x = pageX - 20 - width;
  } else {
    x = pageX + 20;
  }
  
  dbg && console.log("x: " + x + ", y: " + y + ", width: " + width + ", height: " + height + ", max_width: " + max_width + ", max_height: " + max_height + ", owidth: " + owidth + ",oheight: " + oheight);

  popup_div.offset({left: x, top: y});

  img.css({"max-height": max_height, "max-width": max_width});
  img.height(height).width(width);
  popup_div.height(height).width(width);
  
  dbg && popup_div.css("border", "3px solid red");
}

function viewport() {
  return {
    x: $(window).scrollLeft(),
    y: $(window).scrollTop(),
    cx: $(window).width(),
    cy: $(window).height()
  };
}

function maybeShowDownloadFeatureNotif() {
  if (!localStorage["downloadFeatureNotifShown"]) {
    $.pnotify({
      title: 'FA Previewer',
      text: 'New Feature: Press the \'S\' key while hovering over an image to save it.  Happy FA\'ing, <3 Sero!',
      type: 'info'
    });
    localStorage["downloadFeatureNotifShown"] = true;
  }
}

function downloadImage(image_src) {
  var a = document.createElement('a');
  a.href = image_src;
  a.download = image_src.split('/').pop().split('?')[0]; // Prettify the download name
  if (!a.download) { a.download = 'fa' + Date.now() + '.jpg'; }
  var clickEvent = document.createEvent('MouseEvent');
  clickEvent.initEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
  a.dispatchEvent(clickEvent);
}

﻿// WebKit的编码转换有点奇怪的

var conv_data = {};
var xconv_gui_options = {
    parallelism: 4,
    parallelism_max: 16
};

function generate_id() {
    ++ conv_data.id_index;

    return conv_data.id_index;
}

function alert_error(content, title) {
    jQuery('<div></div>')
        .html('<span class="ui-icon ui-icon-alert" style="float:left; margin:0 7px 20px 0;"></span>' + content + '<div style="clear: both;"></div>')
        .dialog({
        modal: true,
        'title': title || '出错啦',
        minWidth: 480,
        minHeight: 200
    });
}

(function ($, window) {

    function reset_conv_data() {
        conv_data = {
            id_index: 0,
            global_options: [],
            groups: {},
            items: {},
            run_seq: 0,
            gui: {
                set_name: null
            },
            tree: [],
            category: {},
            file_map: {}
        };
    }

    function get_dom_file(dom_id) {
        var ret = {
            file: null,
            path: '',
            filename: '',
            dirname: '.'
        };
        
        var sel_dom = document.getElementById(dom_id);
        if (!sel_dom) {
            return ret;
        }
        
        ret.file = sel_dom.files.length > 0? sel_dom.files[0]: null;
        if (ret.file) {
            ret.path = ret.file.path || sel_dom.value;
        } else {
            ret.path = sel_dom.value;
        }
        
        var mres = ret.path.match(/[^\/\\]*$/);
        if (mres) {
            ret.filename = mres[0];  
        }
        
        if (ret.filename && ret.path.length > ret.filename.length + 1) {
            ret.dirname = ret.path.substr(0, ret.path.length - ret.filename.length - 1);  
        } else if (ret.filename && ret.path.length == ret.filename.length + 1) {
            ret.dirname = ret.path[0];
        }
        
        return ret;
    }
    
    function build_conv_tree(context, current_path, callback) {
        // $("#conv_list").empty();

        // 初始化
        var jdom = $(context);

        var include_list = [];
        // nw.js/electron 获取文件路径
        var prefix_dir = current_path.replace(/[^\\\/]*$/, "");
        //// 加载include项目
        $.each(jdom.children("include"), function(k, dom){
            var file_path = $(dom).html();
            if (file_path) {
                if (!file_path.match(/^(\w:|\/)/i)) {
                    file_path = prefix_dir + file_path;
                }
                include_list.push(file_path);
            }
        });

        var active_run = (function(){
            // 加载并覆盖全局配置
            $.each(jdom.children("global").children(), function(k, dom){
                var tn = dom.tagName.toLowerCase();
                var val = $(dom).html().trim();

                if ("work_dir" == tn) {
                    $("#conv_list_work_dir").val(val);
                } else if ("xresloader_path" == tn) {
                    $("#conv_list_xresloader").val(val);
                } else if ("proto_file" == tn) {
                    $("#conv_list_proto_file").val(val);
                }else if ("output_dir" == tn) {
                    $("#conv_list_output_dir").val(val);
                } else if ("data_src_dir" == tn) {
                    $("#conv_list_data_src_dir").val(val);
                } else if ("rename" == tn) {
                    $("#conv_list_rename").val(val);
                } else if ("proto" == tn) {
                    $("#conv_list_protocol").get(0).selectedIndex = $("#conv_list_protocol option[value=" + val + "]").get(0).index;
                } else if ("output_type" == tn) {
                    $("#conv_list_output_type").get(0).selectedIndex = $("#conv_list_output_type option[value=" + val + "]").get(0).index;
                } else if ("option" == tn && val) {
                    conv_data.global_options.push({
                        name: $(dom).attr('name') || val,
                        desc: $(dom).attr('desc') || val,
                        value: val
                    });
                }
            });

            // 加载分类信息
            var treeData = conv_data.tree;
            var cat_map = conv_data.category;
            function build_tree_fn(root, xml_dom) {
                $.each($(xml_dom).children("tree"), function(k, xml_node) {
                    var nj_node = $(xml_node);
                    var new_option = {
                        title: nj_node.attr("name") || nj_node.attr("id"),
                        tooltip: nj_node.attr("name") || nj_node.attr("id"),
                        folder: true,
                        children: []
                    };

                    if (nj_node.attr('id')) {
                        cat_map[nj_node.attr('id')] = new_option;
                    }

                    build_tree_fn(new_option.children, nj_node);
                    root.push(new_option);
                });
            };
            build_tree_fn(treeData, jdom.children("category"));

            // GUI 显示规则
            $.each(jdom.children("gui").children("set_name"), function(k, dom){
                conv_data.gui.set_name = eval($(dom).html());
            });

            $.each(jdom.children("list").children("item"), function(k, item_node) {
                var jitem = $(item_node);
                var id = generate_id();

                var item_data = {
                    id: id,
                    file: jitem.attr('file'),
                    scheme: jitem.attr('scheme'),
                    name: (jitem.attr('name').trim() || ""),
                    cat: jitem.attr('cat'),
                    options: [],
                    desc: (jitem.attr('name').trim() || jitem.attr('desc').trim() || "")  + " -- 文件名: \"" + jitem.attr("file") + "\" 描述信息: \"" + jitem.attr("scheme") + "\""
                };

                // GUI 显示规则
                if (conv_data.gui.set_name) {
                    try {
                        item_data = conv_data.gui.set_name(item_data) || item_data;
                    } catch (err) {
                        assert("ERROR: " + err.toString());
                    }
                }

                $.each(jitem.children('option'), function(k, v){
                    var nj_node = $(v);
                    item_data.options.push({
                        name: nj_node.attr('name'),
                        desc: nj_node.attr('desc'),
                        value: nj_node.html()
                    });
                });
                conv_data.items[item_data.id] = item_data;

                var ft_node = {
                    title: item_data.name,
                    tooltip: item_data.desc,
                    key: item_data.id
                };
                if (item_data.cat && cat_map[item_data.cat]) {
                    cat_map[item_data.cat].children.push(ft_node);
                } else {
                    treeData.push(ft_node);
                }
            });

            if (callback) {
                callback();
            }
        });


        var load_one_by_one = {fn: null};
        load_one_by_one.fn = function () {
            var file_path = null;
            var file_inst = null;
            var fs = require('fs'); // node.js - File System
            
            while (include_list.length > 0) {
                file_path = include_list.shift();

                try {
                    file_inst = fs.createReadStream(file_path);
                    if (conv_data.file_map[file_path]) {
                        alert("文件 " + file_path + " 已被加载过，不能循环include文件");
                        file_path = null;
                        file_inst = null;
                    } else {
                        conv_data.file_map[file_path] = true;
                        break;
                    }
                } catch (e) {
                    alert("文件 " + file_path + " 加载失败。" + e.toString());
                    file_inst = null;
                }
            }

            if (file_inst) {
                var file_loader = new FileReader();

                file_inst.on('data', (content) => {
                    build_conv_tree(content.toString(), file_path, function(){
						load_one_by_one.fn();
					});
                });
                
                file_inst.on('error', (err) => {
                    console.error(err.toString());
                    console.error(err.stack);
                    alert("尝试读取文件失败:" +　file_path);
                    load_one_by_one.fn();
                });
                
                // file_loader.onload = (function(ev) {
                //     build_conv_tree(ev.target.result, file_path, function(){
				// 		load_one_by_one.fn();
				// 	});
                // });
				
				// 出错则直接回调
				// file_loader.onerror = (function(){
				// 	load_one_by_one.fn();
				// });

                // file_loader.onerror = function(ev) {
                //     alert("尝试读取文件失败:" +　file_path);
                // };

                // file_loader.readAsText(file_inst);
            } else {
                active_run();
            }
        };

        load_one_by_one.fn();
    }

    function show_conv_tree() {
        if($("#conv_list").children().length > 0) {
            $("#conv_list").fancytree("destroy");
        }
        $("#conv_list").fancytree({
            checkbox: true,
            selectMode: 3,
            source: conv_data.tree,
            dblclick: function(event, data) {
                data.node.toggleSelected();
            },
            keydown: function(event, data) {
                if( event.which === 32 ) {
                    data.node.toggleSelected();
                    return false;
                }
            },
            cookieId: "conv_list-ft",
            idPrefix: "conv_list-ft-"
        });
    }
    
    function shell_color_to_html(data) {
        var style_map = {
            "1": "font-weight: bolder;",
            "4": "text-decoration: underline;",
            "30": "color: black;",
            "31": "color: darkred;",
            "32": "color: darkgreen;",
            "33": "color: brown;",
            "34": "color: darkblue;",
            "35": "color: purple;",
            "36": "color: darkcyan;",
            "37": "color: gray;",
            "40": "background-color: black;",
            "41": "background-color: darkred;",
            "42": "background-color: darkgreen;",
            "43": "background-color: brown;",
            "44": "background-color: darkblue;",
            "45": "background-color: purple;",
            "46": "background-color: darkcyan;",
            "47": "background-color: white;"
        };

        var split_group = data.toString().split(/(\[[\d;]*m)/g);
        var span_level = 0;

        function finish_tail() {
            var ret = '';
            while (span_level > 0) {
                -- span_level;
                ret += '</span>';
            }
            return ret;
        }
        for (var i = 0; i < split_group.length; ++ i) {
            var msg = split_group[i];
            if (msg.match(/^\[[\d;]*m$/)) {
                var all_flags = msg.match(/\d+/g);
                var style_list = [];
                for (var j = 0; all_flags && j < all_flags.length; ++ j) {
                    if ('0' == all_flags[j]) {
                        split_group[i] = finish_tail();
                        break;
                    } else if (style_map[all_flags[j]]) {
                        style_list.push(style_map[all_flags[j]]);
                    }
                }

                if (style_list.length > 0) {
                    ++ span_level;
                    split_group[i] = '<span style="' + style_list.join(' ') + '">';
                } else {
                    split_group[i] = finish_tail();
                }
            }
        }

        return split_group.join('') + finish_tail();
    }
    
    function conv_start() {
        try {
            var work_dir = $("#conv_list_work_dir").val();
            if (work_dir && work_dir[0] != '/' && (work_dir.length < 2 || work_dir[1] != ':')) {
                work_dir = get_dom_file('conv_list_file').dirname + "/" + work_dir;
            }

            var xresloader_path = $("#conv_list_xresloader").val();

            var global_options = {
                "-p": $("#conv_list_protocol").val(),
                "-t": $("#conv_list_output_type").val(),
                "-f": $("#conv_list_proto_file").val(),
                "-o": $("#conv_list_output_dir").val(),
                "-d": $("#conv_list_data_src_dir").val(),
                "-n": $("#conv_list_rename").val()
            };

            var tree = $("#conv_list").fancytree("getTree");
            var selNodes = tree.getSelectedNodes();

            var cmd_params = "";
            for(var k in global_options) {
                if (global_options[k]) {
                    cmd_params += " " + k + " \"" + global_options[k] + "\"";
                }
            }

            $.each(conv_data.global_options, function(k, v){
                cmd_params += " " + v.value;
            });

            var run_log = $("#conv_list_run_res");
            run_log.empty();
            run_log.removeClass('conv_list_run_error');
            run_log.removeClass('conv_list_run_success');
            run_log.addClass('conv_list_run_running');

            var pending_script = [];

            selNodes.forEach(function(node) {
                if (node.key && conv_data.items[node.key]) {
                    var item_data = conv_data.items[node.key];
                    var cmd_args = cmd_params;
                    $.each(item_data.options, function(k, v){
                        cmd_args += " " + v.value;
                    });

                    cmd_args += " -s \"" + item_data.file + "\" -m \"" + item_data.scheme + "\"";

                    pending_script.push(cmd_args);
                }
            });

            var run_seq = generate_id();
            var running_count = 0;
            var failed_count = 0;
            conv_data.run_seq = run_seq;

            function run_one_cmd(xresloader_index, xresloader_exec) {
                if (pending_script.length > 0 && conv_data.run_seq == run_seq) {
                    var cmd = pending_script.pop();
                    run_log.append("[CONV " + xresloader_index + "] " + cmd + "\r\n");
                    run_log.scrollTop(run_log.prop('scrollHeight'));

                    xresloader_exec.stdin.write(cmd)
                    xresloader_exec.stdin.write("\r\n")
                } else {
                    xresloader_exec.stdin.end()
                }
            }

            running_count = xconv_gui_options.parallelism;
            for(var i = 0; i < xconv_gui_options.parallelism; ++ i) {
                (function(xresloader_index) {
                    var spawn = require('child_process').spawn;
                    var xresloader_cmds = ["-client", "-Dfile.encoding=UTF-8", "-jar", xresloader_path, "--stdin"];
                    run_log.append("[" + work_dir + "] Process " + xresloader_index + ": " + xresloader_cmds.join(' ') + "\r\n");
                    console.log('start xresloader at ' + work_dir);
                    var xresloader_exec = spawn('java', xresloader_cmds, {
                        cwd: work_dir,
                        encoding: 'utf8'
                    });

                    xresloader_exec.stdout.on('data', function (data) {
                        run_log.append("<span style='color: Green;'>" + shell_color_to_html(data) + "</span>\r\n");
                        run_log.scrollTop(run_log.prop('scrollHeight'));
                        run_one_cmd(xresloader_index, xresloader_exec);
                    });

                    xresloader_exec.stderr.on('data', function (data) {
                        run_log.append("<strong style='color: Red;'>" + shell_color_to_html(data) + "</strong>\r\n");
                        run_log.scrollTop(run_log.prop('scrollHeight'));
                        run_one_cmd(xresloader_index, xresloader_exec);
                    });

                    xresloader_exec.on('close', function (code) {
                        run_log.append("[Process " + xresloader_index + " Exit]\r\n");
                        --running_count;

                        if (code > 0) {
                            failed_count += code;
                        }

                        if (running_count <= 0 && conv_data.run_seq == run_seq) {
                            if (failed_count > 0) {
                                run_log.append("<span style='color: DarkRed;'>All jobs done, " + failed_count + " job(s) failed.</strong>\r\n");
                                run_log.addClass('conv_list_run_error');
                                run_log.removeClass('conv_list_run_running');
                            } else {
                                run_log.append("<span style='color: DarkRed;'>All jobs done.</strong>\r\n");
                                run_log.addClass('conv_list_run_success');
                                run_log.removeClass('conv_list_run_running');
                            }
                            run_log.scrollTop(run_log.prop('scrollHeight'));
                        }
                    });
                    run_one_cmd(xresloader_index, xresloader_exec);
                })(i + 1);
            }
        } catch(e) {
            run_log.append("<strong style='color: Red;'>" + e.toString() + "</strong>\r\n");
            run_log.scrollTop(run_log.prop('scrollHeight'));
            alert("出错啦: " + e.toString());
        } 
    }

    $(document).ready(function(){
        // 并行转表选项
        (function(){
            // 获取CPU信息，默认并行度为CPU核心数量/2
            try {
                xconv_gui_options.parallelism = parseInt((require('os').cpus().length - 1) / 2 + 1);

                // 实际使用过程中发现，java的运行时优化反而比并行执行更节省性能
                if (xconv_gui_options.parallelism > 2) {
                    xconv_gui_options.parallelism = 2;
                }
            } catch(e) {
                console.log('judge cpu count require node.js');
                xconv_gui_options.parallelism = 2;
            }

            var father_dom = $("#conv_config_parallelism");
            for(var i = 0; i < xconv_gui_options.parallelism_max; ++ i) {
                var paral_opt = $("<option></option>");
                paral_opt.attr("value", i + 1);
                paral_opt.prop("value", i + 1);
                paral_opt.html(i + 1);

                if (xconv_gui_options.parallelism == i + 1) {
                    paral_opt.attr("selected", "selected");
                    paral_opt.attr("selected", true);
                }

                father_dom.append(paral_opt);
            }

            console.log("转表并发数: " + xconv_gui_options.parallelism);
            father_dom.change(function() {
                var new_value = parseInt(father_dom.val());
                if (xconv_gui_options.parallelism == new_value) {
                    return;
                }

                if (new_value <= 6) {
                    xconv_gui_options.parallelism = new_value;
                    console.log("转表并发数: " + xconv_gui_options.parallelism);
                } else {
                    var dlg = $("<div></div>");
                    dlg.append("并发度过大时会导致JVM有很高的内存消耗，可能会导致执行过程中达到JVM堆栈内存而崩溃。").append("<br />");
                    dlg.append("通常可以通过修改JVM默认内存限制实现。(如: -Xmx 2048m)").append("<br />");
                    dlg.append("您确定要把并发转表的进程数调整到 " + new_value + "吗？").append("<br />");

                    $(dlg).dialog({
                        title: "高并行度警告",
                        resizable: false,
                        height:240,
                        width: 360,
                        modal: true,
                        buttons: {
                            "是": function() {
                                xconv_gui_options.parallelism = new_value;
                                console.log("转表并发数: " + xconv_gui_options.parallelism);

                                $( this ).dialog( "close" );
                            },
                            "否": function() {
                                $( this ).dialog( "close" );
                            }
                        },
                        close: function() {
                            if (xconv_gui_options.parallelism != new_value) {
                                father_dom.get(0).selectedIndex = xconv_gui_options.parallelism - 1;
                            }

                        }
                    });
                }
            });
        })();

        $("#conv_list_file_btn").click(function(){
            $("#conv_list_file").val("");
            $("#conv_list_file").click();
        });
        $("#conv_list_file").click(function(){
            $(this).val("");
        });

        $("#conv_list_file").bind("change", function(){
            var clf = get_dom_file('conv_list_file');
            $("#conv_list_file_val").val(clf.path);

            var file_loader = new FileReader();

            file_loader.onload = function(ev) {
                reset_conv_data();

                conv_data.file_map[clf.path] = true;

                build_conv_tree(ev.target.result, clf.path, function(){
                    // 显示属性树
                    show_conv_tree();
                });
            };

            file_loader.onerror = function(ev) {
                alert("尝试读取文件失败:" +　file_path);
            };

            if (clf.file) {
                file_loader.readAsText(clf.file);
            }
        });

        $("#conv_list_btn_select_all").click(function(){
            $("#conv_list").fancytree("getRootNode").visit(function(node){
                node.setSelected(true);
            });
        });

        $("#conv_list_btn_select_none").click(function(){
            $("#conv_list").fancytree("getRootNode").visit(function(node){
                node.setSelected(false);
            });
        });

        $("#conv_list_btn_expand").click(function(){
            $("#conv_list").fancytree("getRootNode").visit(function(node){
                node.setExpanded(true);
            });
        });

        $("#conv_list_btn_collapse").click(function(){
            $("#conv_list").fancytree("getRootNode").visit(function(node){
                node.setExpanded(false);
            });
        });

        $("#conv_list_btn_start_conv").click(function(){
            conv_start();
        });
        
        var rename_templates = [{
                value: "/\\.bin$/.lua/",
                label: ".bin后缀 => .lua"
            },{
                value: "/\\.bin$/.json/",
                label: ".bin后缀 => .json"
            },{
                value: "/\\.bin$/.msgpack.bin/",
                label: ".bin后缀 => .msgpack.bin"
            },{
                value: "/\\.bin$/.xml/",
                label: ".bin后缀 => .xml"
            }
        ];

        $( "#conv_list_rename" ).autocomplete({
            minLength: 0,
            source: rename_templates,
            focus: function( event, ui ) {
                $( "#conv_list_rename" ).val( ui.item.value );
                return false;
            },
            select: function( event, ui ) {
                $( "#project" ).val( ui.item.value );
                return false;
            }
        }).autocomplete( "instance" )._renderItem = function( ul, item ) {
            return $( "<li>" )
            .append( "<a>" + item.label + "</a>" )
            .appendTo( ul );
        };
        $("#conv_list_rename").dblclick(function(){
            $( "#conv_list_rename" ).autocomplete("search", "");
        });
    });
})(jQuery, window);
